-- The write path. All game-state mutation funnels through two
-- security-definer functions so every run costs exactly one round-trip and
-- one transaction, and so score plausibility is enforced server-side before
-- anything can touch a leaderboard. Reads that need cross-player data
-- (display names on boards) go through get_leaderboard rather than opening
-- profiles or leaderboard_entries to the world.

-- ------------------------------------------------------------- submit_run

-- Payload: { run_id, region, score, correct, best_streak,
--            guesses: [{ iso, res: hit|reveal|skip, tries, hints, points }] }
--
-- The server re-walks the guess log: streaks, counts and the total score are
-- re-derived, and each guess's points must fit under the scoring formula's
-- hard cap (BASE 1000 × combo 2^min(streak,11) × speed ≤1.5, plus one 50k
-- discovery bonus). The client-generated run_id makes retries idempotent.
create or replace function public.submit_run(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := (select auth.uid());
  v_run_id uuid;
  v_region text;
  v_guesses jsonb;
  v_count integer;
  g jsonb;
  v_res text;
  v_tries integer;
  v_hints integer;
  v_points bigint;
  v_streak integer := 0;
  v_best_streak integer := 0;
  v_hits integer := 0;
  v_drops integer := 0;
  v_sum bigint := 0;
  v_new_stamps text[];
  v_stats public.player_stats;
  v_board_alltime text;
  v_board_weekly text;
  v_rank_alltime bigint;
  v_rank_weekly bigint;
begin
  if v_player is null then
    raise exception 'not authenticated';
  end if;

  v_run_id := (p ->> 'run_id')::uuid;
  v_region := p ->> 'region';
  v_guesses := p -> 'guesses';

  if v_run_id is null or v_region is null
     or jsonb_typeof(v_guesses) is distinct from 'array' then
    raise exception 'malformed payload';
  end if;

  v_count := jsonb_array_length(v_guesses);
  if v_count not between 1 and 20 then
    raise exception 'malformed payload';
  end if;

  for g in select value from jsonb_array_elements(v_guesses) loop
    v_res := g ->> 'res';
    v_tries := coalesce((g ->> 'tries')::integer, -1);
    v_hints := coalesce((g ->> 'hints')::integer, -1);
    v_points := coalesce((g ->> 'points')::bigint, -1);
    if coalesce(g ->> 'iso', '') !~ '^[A-Z]{2}$'
       or v_res not in ('hit', 'reveal', 'skip')
       or v_tries not between 1 and 3
       or v_hints not between 0 and 3
       or v_points < 0 then
      raise exception 'malformed guess';
    end if;
    if v_res = 'hit' then
      if v_points > 1500::bigint * (1 << least(v_streak, 11)) + 50000 then
        raise exception 'implausible score';
      end if;
      v_streak := v_streak + 1;
      v_best_streak := greatest(v_best_streak, v_streak);
      v_hits := v_hits + 1;
      v_drops := v_drops + v_tries;
    else
      if v_points <> 0 then
        raise exception 'implausible score';
      end if;
      v_streak := 0;
      -- A skip's final attempt never dropped a pin; a reveal's did.
      v_drops := v_drops + case when v_res = 'skip' then v_tries - 1 else v_tries end;
    end if;
    v_sum := v_sum + v_points;
  end loop;

  if v_sum is distinct from (p ->> 'score')::bigint then
    raise exception 'score mismatch';
  end if;

  insert into public.runs (id, player_id, region, round_length, score, correct_count, best_streak, guesses)
  values (v_run_id, v_player, v_region, v_count, v_sum, v_hits, v_best_streak, v_guesses)
  on conflict (id) do nothing;

  if not found then
    -- Retried submission: aggregates already include this run.
    select * into v_stats from public.player_stats where player_id = v_player;
    return jsonb_build_object('duplicate', true, 'stats', to_jsonb(v_stats), 'ranks', null);
  end if;

  with hit_isos as (
    select distinct h ->> 'iso' as iso
    from jsonb_array_elements(v_guesses) h
    where h ->> 'res' = 'hit'
  ), stamped as (
    insert into public.passport_stamps (player_id, country_iso)
    select v_player, iso from hit_isos
    on conflict do nothing
    returning country_iso
  )
  select coalesce(array_agg(country_iso), '{}') into v_new_stamps from stamped;

  insert into public.player_country_stats as pcs (player_id, country_iso, hits, misses, hints_used)
  select
    v_player,
    h ->> 'iso',
    count(*) filter (where h ->> 'res' = 'hit'),
    coalesce(sum(case
      when h ->> 'res' = 'reveal' then (h ->> 'tries')::integer
      else (h ->> 'tries')::integer - 1
    end), 0),
    coalesce(sum((h ->> 'hints')::integer), 0)
  from jsonb_array_elements(v_guesses) h
  group by h ->> 'iso'
  on conflict (player_id, country_iso) do update set
    hits = pcs.hits + excluded.hits,
    misses = pcs.misses + excluded.misses,
    hints_used = pcs.hints_used + excluded.hints_used,
    last_seen_at = now();

  insert into public.player_stats as ps
    (player_id, runs, correct, guesses, best_score, best_streak, countries_discovered, last_played_at)
  values
    (v_player, 1, v_hits, v_drops, v_sum, v_best_streak,
     coalesce(array_length(v_new_stamps, 1), 0), now())
  on conflict (player_id) do update set
    runs = ps.runs + 1,
    correct = ps.correct + excluded.correct,
    guesses = ps.guesses + excluded.guesses,
    best_score = greatest(ps.best_score, excluded.best_score),
    best_streak = greatest(ps.best_streak, excluded.best_streak),
    countries_discovered = ps.countries_discovered + excluded.countries_discovered,
    last_played_at = now()
  returning * into v_stats;

  v_board_alltime := 'alltime:' || v_region;
  v_board_weekly := 'weekly:' || to_char(now(), 'IYYY-"W"IW') || ':' || v_region;

  if v_sum > 0 then
    insert into public.leaderboard_entries as le (board, player_id, score, correct_count, round_length)
    select b, v_player, v_sum, v_hits, v_count
    from unnest(array[v_board_alltime, v_board_weekly]) b
    on conflict (board, player_id) do update set
      score = excluded.score,
      correct_count = excluded.correct_count,
      round_length = excluded.round_length,
      achieved_at = now()
    where excluded.score > le.score;
  end if;

  select (select count(*) + 1 from public.leaderboard_entries
          where board = v_board_alltime and score > le.score)
  into v_rank_alltime
  from public.leaderboard_entries le
  where le.board = v_board_alltime and le.player_id = v_player;

  select (select count(*) + 1 from public.leaderboard_entries
          where board = v_board_weekly and score > le.score)
  into v_rank_weekly
  from public.leaderboard_entries le
  where le.board = v_board_weekly and le.player_id = v_player;

  return jsonb_build_object(
    'duplicate', false,
    'stats', to_jsonb(v_stats),
    'new_stamps', to_jsonb(v_new_stamps),
    'ranks', jsonb_build_object('alltime', v_rank_alltime, 'weekly', v_rank_weekly)
  );
end;
$$;

revoke all on function public.submit_run(jsonb) from public, anon;
grant execute on function public.submit_run(jsonb) to authenticated;

-- ----------------------------------------------------- import_guest_state

-- One-time replay of a guest device bucket after first login. Guarded by
-- profiles.guest_import_done (locked row) so it can never be replayed to
-- inflate stats, and unverified guest play merges into stats and passport
-- but deliberately never mints leaderboard entries.
-- Payload: { settings: {...}|null, stats: {runs,correct,guesses,bestScore,bestStreak}|null,
--            passport: { "FR": "iso timestamp", ... }|null }
create or replace function public.import_guest_state(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := (select auth.uid());
  v_done boolean;
  v_stats public.player_stats;
begin
  if v_player is null then
    raise exception 'not authenticated';
  end if;

  select guest_import_done into v_done
  from public.profiles where id = v_player for update;
  if v_done is null then
    raise exception 'no profile';
  end if;
  if v_done then
    return jsonb_build_object('imported', false);
  end if;
  update public.profiles set guest_import_done = true where id = v_player;

  if jsonb_typeof(p -> 'passport') = 'object' then
    insert into public.passport_stamps (player_id, country_iso, first_discovered_at)
    select v_player, key,
           least(coalesce(nullif(value, '')::timestamptz, now()), now())
    from jsonb_each_text(p -> 'passport')
    where key ~ '^[A-Z]{2}$'
    on conflict (player_id, country_iso) do update set
      first_discovered_at =
        least(public.passport_stamps.first_discovered_at, excluded.first_discovered_at);
  end if;

  if jsonb_typeof(p -> 'stats') = 'object' then
    insert into public.player_stats as ps (player_id, runs, correct, guesses, best_score, best_streak)
    values (
      v_player,
      least(greatest(coalesce((p -> 'stats' ->> 'runs')::bigint, 0), 0), 1000000),
      least(greatest(coalesce((p -> 'stats' ->> 'correct')::bigint, 0), 0), 20000000),
      least(greatest(coalesce((p -> 'stats' ->> 'guesses')::bigint, 0), 0), 60000000),
      least(greatest(coalesce((p -> 'stats' ->> 'bestScore')::bigint, 0), 0), 100000000),
      least(greatest(coalesce((p -> 'stats' ->> 'bestStreak')::integer, 0), 0), 1000)
    )
    on conflict (player_id) do update set
      runs = ps.runs + excluded.runs,
      correct = ps.correct + excluded.correct,
      guesses = ps.guesses + excluded.guesses,
      best_score = greatest(ps.best_score, excluded.best_score),
      best_streak = greatest(ps.best_streak, excluded.best_streak);
  end if;

  -- The passport is the source of truth for the discovery count.
  insert into public.player_stats as ps (player_id, countries_discovered)
  values (v_player, 0)
  on conflict (player_id) do nothing;
  update public.player_stats set countries_discovered =
    (select count(*) from public.passport_stamps where player_id = v_player)
  where player_id = v_player;

  if jsonb_typeof(p -> 'settings') = 'object' then
    insert into public.player_settings (player_id, settings)
    values (v_player, p -> 'settings')
    on conflict (player_id) do nothing;
  end if;

  select * into v_stats from public.player_stats where player_id = v_player;
  return jsonb_build_object('imported', true, 'stats', to_jsonb(v_stats));
end;
$$;

revoke all on function public.import_guest_state(jsonb) from public, anon;
grant execute on function public.import_guest_state(jsonb) to authenticated;

-- --------------------------------------------------------- get_leaderboard

-- Public top-N for one board plus the caller's own rank when signed in.
-- 'thisweek:<region>' resolves to the current ISO week server-side so
-- clients never compute week keys (and never drift from the server's).
create or replace function public.get_leaderboard(p_board text, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_player uuid := (select auth.uid());
  v_entries jsonb;
  v_me jsonb;
begin
  if p_board like 'thisweek:%' then
    p_board := 'weekly:' || to_char(now(), 'IYYY-"W"IW') || ':' || substring(p_board from 10);
  end if;
  if p_board !~ '^(alltime|weekly:[0-9]{4}-W[0-9]{2}):[A-Za-z ]+$' then
    raise exception 'bad board';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);

  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rnk,
           'name', t.display_name,
           'score', t.score,
           'correct', t.correct_count,
           'rounds', t.round_length,
           'when', t.achieved_at)), '[]'::jsonb)
  into v_entries
  from (
    select row_number() over (order by le.score desc, le.achieved_at asc) as rnk,
           pr.display_name, le.score, le.correct_count, le.round_length, le.achieved_at
    from public.leaderboard_entries le
    join public.profiles pr on pr.id = le.player_id
    where le.board = p_board
    order by le.score desc, le.achieved_at asc
    limit p_limit
  ) t;

  if v_player is not null then
    select jsonb_build_object(
      'rank', (select count(*) + 1 from public.leaderboard_entries
               where board = p_board and score > le.score),
      'score', le.score)
    into v_me
    from public.leaderboard_entries le
    where le.board = p_board and le.player_id = v_player;
  end if;

  return jsonb_build_object('entries', v_entries, 'me', v_me);
end;
$$;

revoke all on function public.get_leaderboard(text, integer) from public, anon;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
