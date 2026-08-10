/**
 * Every user-visible string in the app lives here so future translation
 * is a single-file effort. Functions are used where grammar needs values.
 */

export const STR = {
  appName: "learnthe.world",
  eyebrow: "Learn the",
  wordmark: "World",
  tagline: "",

  menu: {
    play: "Play",
    /** Just where you're playing — the continent plate on the globe carries
        the country count, and the round length belongs in Settings. */
    playContext: (region: string) => region,
    explore: "Explore the map",
    passport: "Passport",
    leaderboard: "High scores",
    settings: "Settings",
    regionLabel: "Where do you want to play?",
    startAria: "Start a game",
    /** The two circular rails of controls that flank the globe. */
    railLeftLabel: "Look and feel",
    railRightLabel: "Your progress",
    worldAll: (n: number) => `All ${n} countries`,
    count: (n: number) => n.toLocaleString(),
    regionTile: (name: string, n: number) => `${name}, ${n} countries`,
    regionChosen: (name: string) => `Region set to ${name}.`,
    regionCleared: "Playing the whole world.",
    regionPlateEyebrow: "Continent",
    regionPlateChosen: "Selected",
    regionPlateSub: (n: number) => `${n} countries`,
    journeyPassportLabel: (found: number, total: number) =>
      `Passport: ${found} of ${total} countries discovered`,
    journeyBestLabel: (score: string) =>
      `High scores: personal best ${score} points`,
  },

  account: {
    guest: "Guest",
    guestSub: "Playing as a guest — progress is saved on this device.",
    memberSub: "Signed in — progress syncs to your account.",
    guestScoreNote: "Guest scores stay on this device.",
    /** The one place we ask for a sign-up — right where the reward lands.
        Worded forward-looking on purpose: signing in carries this device's
        passport and best score over, and puts every run after it on the
        global board (the run just played was scored as a guest). */
    saveScoreCta: "Save your scores online",
    saveScoreCtaSub:
      "Free account — your passport follows you to any device, and your runs join the global board.",
    openLabel: "Account — sign in or manage your profile",
    sheetTitle: "Your account",
    signInTitle: "Sign in",
    signInIntro:
      "Create a free account to keep your passport and scores with you on any device.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    sendCode: "Email me a sign-in code",
    sending: "Sending…",
    codeSentTo: (email: string) => `We sent a sign-in email to ${email}.`,
    codeSentHint: "Tap the link in the email, or enter the 6-digit code below.",
    codeLabel: "6-digit code",
    verify: "Sign in",
    verifying: "Checking…",
    resend: "Send a new code",
    useDifferentEmail: "Use a different email",
    orContinueWith: "Or continue with",
    providerGoogle: "Google",
    providerGitHub: "GitHub",
    providerApple: "Apple",
    providerError:
      "That sign-in method isn't switched on yet — try the email code instead.",
    genericError: "Something went wrong. Please try again.",
    signedInAs: (email: string) => `Signed in as ${email}`,
    displayNameLabel: "Display name",
    displayNameSave: "Save name",
    displayNameSaved: "Saved!",
    signOut: "Sign out",
    signedIn: "You're signed in!",
  },

  regions: {
    World: "World",
    Africa: "Africa",
    Asia: "Asia",
    Europe: "Europe",
    "North America": "N. America",
    "South America": "S. America",
    Oceania: "Oceania",
    "Seven seas (open ocean)": "Remote islands",
    Antarctica: "Antarctica",
  } as Record<string, string>,

  game: {
    find: "Find",
    progressShort: (i: number, n: number) => `${i}/${n}`,
    progressAria: (i: number, n: number) => `Country ${i} of ${n}`,
    hintsAria: (n: number) =>
      n === 0 ? "No hints left for this country" : `Hint, ${n} left for this country`,
    score: "Score",
    streak: "Streak",
    streakChip: (mult: number) => `streak ×${mult.toLocaleString()}`,
    hint: "Hint",
    skip: "Skip",
    pause: "Pause",
    quit: "Leave",
    resume: "Keep playing",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    /** Ocean taps never cost a try — they're misclicks, not guesses. */
    tapLand: "Pins only land on a country — try again on land.",
    attemptsLeft: (n: number) => (n === 1 ? "Last try!" : `${n} tries left`),
    correct: ["Nailed it!", "Spot on!", "You got it!", "Brilliant!", "Cartographer!"],
    bullseye: "Bullseye!",
    discovery: "New discovery!",
    miss: (km: string) => `${km} away`,
    missWarm: "So close!",
    reveal: (name: string) => `It was ${name}`,
    revealSub: "Drag the map to look around — that pauses the timer.",
    next: "Next",
    accuracy: (pct: number) => `${pct}% to the heart`,
    speedFast: "Lightning fast",
    speedQuick: "Quick!",
    hintContinent: (c: string) => `It's in ${c}`,
    hintCapitalFlag: (flag: string, cap: string) =>
      cap ? `${flag} Its capital is ${cap}` : `Its flag is ${flag}`,
    hintPopulation: (p: string) => `About ${p} people live there`,
    hintCost: "Hints trim your points a little.",
    noHintsLeft: "No hints left for this one",
    skipped: (name: string) => `That was ${name}`,
  },

  compass: {
    N: "north",
    NE: "north-east",
    E: "east",
    SE: "south-east",
    S: "south",
    SW: "south-west",
    W: "west",
    NW: "north-west",
  } as Record<string, string>,

  results: {
    title: "Round complete!",
    finalScore: "Final score",
    correct: "Correct",
    bestStreak: "Best streak",
    accuracy: "Accuracy",
    fastest: "Fastest pin",
    discoveries: "New discoveries for your passport",
    playAgain: "Play again",
    backToMenu: "Back to menu",
    savePrompt: "Add your name to the high scores",
    namePlaceholder: "Explorer",
    save: "Save score",
    saved: "Saved to high scores!",
    newBest: "New personal best!",
    syncedNote: "Score synced to the global leaderboard.",
    globalWeekly: (rank: string) => `#${rank} on this week's global board`,
  },

  passport: {
    title: "Passport",
    progress: (found: number, total: number) => `${found} of ${total} countries discovered`,
    locked: "Not discovered yet",
    hintText: "Guess a country correctly for the first time to stamp it here.",
    recentTitle: "Recent guesses",
    recentNote:
      "Rounds gently favour places you haven't met yet — and the ones that got away.",
    logHit: "Got it",
    logHitIn: (n: number) => `Got it in ${n}`,
    logHints: (n: number) => (n === 1 ? "1 hint" : `${n} hints`),
    logReveal: "Got away",
    logSkip: "Skipped",
  },

  leaderboard: {
    title: "High scores",
    empty: "No scores yet — play a round and make history!",
    meta: (region: string, date: string) => `${region} · ${date}`,
    tabDevice: "This device",
    tabGlobal: "Global",
    boardAlltime: "All-time",
    boardWeekly: "This week",
    globalMeta: (correct: number, rounds: number) => `${correct}/${rounds} correct`,
    loading: "Loading scores…",
    loadError: "Couldn't reach the global board — check your connection.",
    globalEmpty: "No global scores here yet — be the first!",
    yourRank: (rank: string) => `Your rank: #${rank}`,
    signInPrompt: "Sign in to appear on the global board.",
    signInCta: "Sign in",
    openLabel: "High scores — global and this device",
  },

  settings: {
    title: "Settings",
    close: "Close",
    tabsLabel: "Settings sections",
    tabs: {
      view: "View",
      game: "Game",
      feel: "Sound",
      help: "Help",
    },
    projection: "Map style",
    projections: {
      globe: "3D Globe",
      naturalEarth: "Natural Earth",
      equalEarth: "Equal Earth",
      mercator: "Mercator",
    } as Record<string, string>,
    graticule: "Grid lines",
    graticuleSub: "Latitude and longitude lines",
    highContrast: "High contrast",
    highContrastSub: "Brighter land and stronger borders",
    roundLength: "Countries per round",
    attempts: "Tries per country",
    hintsEnabled: "Allow hints",
    speedBonus: "Speed bonus",
    speedBonusSub: "Extra points for fast answers",
    sound: "Sound effects",
    haptics: "Vibration",
    hapticsSub: "On supported phones",
    reduceMotion: "Reduce motion",
    reduceMotionSub: "Calmer animations",
    motionAuto: "Auto",
    motionOn: "On",
    motionOff: "Off",
    replayTutorial: "Show the tour again",
    keyboardTitle: "Keyboard controls",
    keyboardHelp:
      "Hold arrow keys to glide · hold + / − to zoom smoothly · Enter drops your pin at the crosshair · H uses a hint · Esc pauses",
    applyTitle: "Apply settings?",
    applyBody:
      "Some of these change how this round works. Restart now with the new rules, or keep this round as-is and use them next time.",
    applyRestart: "Restart match",
    applyNext: "Apply next match",
  },

  themes: {
    title: "Worlds",
    intro: "Same planet, new light. Every world keeps the game easy to read.",
    openLabel: "Change world colours",
    settingsRow: "World colours",
    groupLabel: "Choose a world",
    customName: "Your world",
    customHint: "Pick any colour — a whole world grows from it.",
    customSwatchAria: (hex: string) => `Custom world colour, currently ${hex}`,
    names: {
      midnightSonar: "Midnight Sonar",
      porcelain: "Porcelain",
      springMeadow: "Spring Meadow",
      cinderforge: "Cinderforge",
      observatory: "Observatory",
      signalTide: "Signal Tide",
      inkstone: "Inkstone",
      custom: "Your world",
    } as Record<string, string>,
    descriptions: {
      midnightSonar: "A night flight: moonlit land on a radar-dark sea.",
      porcelain: "White glaze and deep ink. Calm, crisp, and clear.",
      springMeadow: "New grass under a clear spring sky.",
      cinderforge: "Ember land over a basalt-black sea.",
      observatory: "A violet void, moon-slate land, starlight signals.",
      signalTide: "Blue and orange only — tuned for red-green colour blindness.",
      inkstone: "Pure light and shade — readable with any colour vision.",
      custom: "Grown from your colour. Feedback stays coral and gold.",
    } as Record<string, string>,
    applied: (name: string) => `World changed to ${name}.`,
  },

  pins: {
    title: "Pins",
    intro: "Pick the marker you drop on the world. Same aim, new landing.",
    openLabel: "Change pin style",
    settingsRow: "Pin style",
    groupLabel: "Choose a pin",
    themedLabel: "Match world colours",
    themedSub: "Paint your pin with this world's palette",
    names: {
      classic: "Classic",
      pushpin: "Push pin",
      star: "Gold star",
      pennant: "Pennant",
      balloon: "Balloon",
      dart: "Dart",
      rocket: "Rocket",
      sprout: "Sprout",
    } as Record<string, string>,
    descriptions: {
      classic: "The trusty teardrop. Symmetry never misses.",
      pushpin: "A glossy head on a slim steel needle — corkboard classic.",
      star: "A gold star for map star students.",
      pennant: "Plant your flag like a true explorer.",
      balloon: "A little balloon bobs where you guessed.",
      dart: "Thrown from across the room. Bullseye pending.",
      rocket: "Touchdown confirmed — the eagle has landed.",
      sprout: "Right answers grow. Wrong ones wilt.",
    } as Record<string, string>,
    applied: (name: string) => `Pin changed to ${name}.`,
  },

  tutorial: {
    offerTitle: "First time here?",
    offerBody: "Want a 20-second tour before you play?",
    offerYes: "Show me",
    offerNo: "No thanks",
    steps: [
      {
        title: "Read the country name",
        body: "Your mission shows up top, like this one. No labels on the map — that's the game!",
      },
      {
        title: "Spin, zoom, and tap",
        body: "Drag to spin, pinch or + / − to zoom, tap to guess. Watch — a near miss! The glowing ring points toward the answer.",
      },
      {
        title: "Build your streak",
        body: "Bullseye — anywhere inside the country counts. Streaks double your points, and first-ever finds join your Passport.",
      },
    ],
    next: "Next",
    done: "Let's play!",
    skipTour: "Skip",
  },

  explore: {
    hint: "Tap any country to learn about it",
    population: (p: string) => `Population ${p}`,
    capital: (c: string) => `Capital: ${c}`,
    inPassport: "In your passport",
    back: "Back",
  },

  a11y: {
    map: "Interactive world map",
    announcePrompt: (name: string, i: number, n: number) =>
      `Question ${i} of ${n}. Find ${name}.`,
    announceCorrect: (name: string, points: string, streak: number) =>
      `Correct! That was ${name}. You earned ${points} points. Streak is ${streak}.`,
    announceMiss: (km: string, dir: string, left: number) =>
      `Not quite. Your pin is ${km} from the target. The glow ring points ${dir}. ${left} ${
        left === 1 ? "try" : "tries"
      } left.`,
    announceReveal: (name: string) => `Out of tries. The country was ${name}.`,
    announceDiscovery: (name: string) => `New discovery! ${name} is now in your passport.`,
    announceGameOver: (score: string) => `Round complete. Final score ${score} points.`,
    pauseDialog: "Pause menu",
    settingsDialog: "Settings",
    crosshairOn: "Keyboard crosshair active. Use arrow keys to aim, Enter to drop your pin.",
  },

  pause: {
    title: "Paused",
    restart: "Restart",
    settings: "Settings",
    tutorial: "Tutorial",
  },

  /** The site footer on the menu — a drop-up drawer behind the pull-tab. */
  footer: {
    navLabel: "Site",
    open: "Open site footer",
    close: "Close site footer",
    mission: "Learn every country on Earth. Free, for everyone.",
    privacy: "Privacy policy",
    guide: "Usability guide",
    settings: "Settings",
    copyright: (year: number) => `© ${year} learnthe.world`,
    builtBy: "Built by",
    builtByName: "digital-knight.au",
    share: "Share",
    /** What the native share sheet carries alongside the link. */
    shareText: "Can you pin every country on the globe? Play free at learnthe.world.",
    copied: "Link copied!",
  },

  /** Shared chrome for the standalone info pages (/privacy and /guide). */
  pages: {
    eyebrow: "learnthe.world",
    back: "Back to the world",
    backAria: "Back to the game",
    toPrivacy: "Privacy policy",
    toGuide: "Usability guide",
  },

  privacyPage: {
    docTitle: "Privacy policy · learnthe.world",
    title: "Privacy policy",
    effective: "Effective 22 July 2026",
    intro:
      "learnthe.world is a free geography game. You can play it fully without an account, and it collects the minimum it needs to run. This page explains what is stored, where it lives, and the choices you have.",
    pledge: {
      title: "We do not sell your data.",
      body: "No ads, no tracking cookies, no data brokers. We use a single, privacy-first analytics service that collects no personal information. Your progress exists for one purpose: the game.",
    },
    guest: {
      title: "Playing as a guest",
      body: "Without an account, your progress never leaves your browser. Settings, passport stamps, scores and guess history live in local storage on your device.",
      points: [
        "Nothing is uploaded and no profile is created",
        "Viewing the global high scores downloads scores only; it sends none of your data",
        "Clearing your browser data erases guest progress",
      ],
    },
    account: {
      title: "If you create an account",
      body: "Signing in stores your game data in our database so it can follow you across devices. We keep:",
      points: [
        "Your email address, used only to sign you in",
        "A display name you choose",
        "Game progress: settings, passport stamps, lifetime stats and finished rounds, including which countries you guessed",
        "Your best scores for the leaderboards",
      ],
      after:
        "Sign-in uses one time email codes or your Google, GitHub or Apple account, so there is no password to store or to leak. Those providers share only your name and email with us.",
    },
    storage: {
      title: "Where your data lives",
      body: "Member data is kept in a managed database (Supabase, on Postgres). Every table is protected by row level security, so your rows can be read by your signed-in session only. All traffic is encrypted over HTTPS. Like any web service, requests include your IP address; we use it for nothing beyond serving the request.",
    },
    visible: {
      title: "What other players see",
      body: "Only what the high score board shows: your display name, score, correct answers and the date. The display name is up to you and can be changed at any time. Nothing else is public.",
    },
    analytics: {
      title: "Analytics",
      body: "We use Vercel Analytics to understand how the site is used — which pages are visited, how long sessions last, and which countries and devices our players come from. This helps us improve the game for everyone.",
      points: [
        "Vercel Analytics does not use cookies and does not track individual users",
        "No personal information is collected — not your IP address, not a device fingerprint",
        "Analytics data is not linked to your game account or progress",
        "Data is aggregated and cannot be used to identify you",
      ],
      after:
        "Because Vercel Analytics is cookieless and collects no personal data, no consent banner is required under the GDPR, ePrivacy Directive or similar regulations.",
    },
    cookies: {
      title: "Cookies and local storage",
      body: "There are no advertising or tracking cookies. The site uses browser local storage for two things: your game progress, and for members the token that keeps you signed in.",
    },
    rights: {
      title: "Your choices and rights",
      points: [
        "Play as a guest; an account is never required",
        "Change your display name in the game at any time",
        "Sign out on any device",
        "Ask for a copy of your data, or ask us to delete your account",
      ],
      after:
        "Deleting your account removes your profile, settings, stats, rounds, passport and leaderboard entries with it.",
    },
    children: {
      title: "Young players",
      body: "The game is built to be safe for young learners. No account is needed to play, so no personal data is needed either. Creating an account requires an email address; players under the age of digital consent in their region should ask a parent or guardian.",
    },
    changes: {
      title: "Changes to this policy",
      body: "If this policy changes, the new version appears here with a new effective date. The promises above will not be weakened quietly.",
    },
    contact: {
      title: "Contact",
      body: "learnthe.world is built and cared for by digital-knight.au. For privacy questions, data requests or deletion, get in touch through",
      linkLabel: "digital-knight.au",
    },
  },

  guidePage: {
    docTitle: "Usability guide · learnthe.world",
    title: "Usability guide",
    intro: "How to play, every control, and how to make the game fit you.",
    round: {
      title: "How a round works",
      points: [
        "A country name appears at the top. Find it and pin it on the world.",
        "Anywhere inside the country counts; landing nearer its heart earns a little more.",
        "A miss tells you how far away you were, and a glowing ring points the way.",
        "Out of tries? The country lights up and reveals itself, so you learn it for next time.",
      ],
    },
    touch: {
      title: "Touch",
      points: [
        "Drag to spin the world",
        "Pinch to zoom",
        "Tap to drop your pin",
        "Ocean taps are free; they never cost a try",
        "On the menu, the arrow at the bottom opens the site footer",
      ],
    },
    mouse: {
      title: "Mouse",
      points: [
        "Drag to spin the world",
        "Scroll to zoom during play",
        "Click to drop your pin",
        "On the menu, the arrow at the bottom opens the site footer",
      ],
    },
    keyboard: {
      title: "Keyboard",
      intro: "The whole game plays without a mouse.",
      keys: [
        { k: "← ↑ ↓ →", label: "Glide the map" },
        { k: "+ / −", label: "Zoom in and out" },
        { k: "Enter", label: "Drop your pin at the crosshair" },
        { k: "H", label: "Use a hint" },
        { k: "S", label: "Skip this country" },
        { k: "Esc", label: "Pause, or close any sheet" },
      ],
    },
    scoring: {
      title: "Scoring",
      points: [
        "Right answers build a streak, and streaks multiply your points",
        "Quick answers earn a speed bonus (optional, in Settings)",
        "Pinning near the centre of a country tops up the score",
        "First-ever finds pay a discovery bonus and stamp your passport",
      ],
    },
    hints: {
      title: "Hints",
      body: "Up to three hints per country, each stronger than the last: population, then capital and flag, then continent. Hints trim a little from your points, so they help you learn without leaning on them.",
    },
    menuTour: {
      title: "Around the menu",
      points: [
        "Tap a continent on the globe to play just that region; tap it again for the whole world",
        "Explore the map: a pressure-free mode for wandering and reading about countries",
        "Passport: every country you have discovered so far",
        "High scores: this device's board plus the global boards",
        "Worlds and Pins: recolour the planet and pick your marker",
      ],
    },
    colourVision: {
      title: "Colour vision",
      body: "Two worlds are tuned for colour blindness: Signal Tide (safe for red-green) and Inkstone (readable with any colour vision). Pick them under Worlds in the game. High contrast, set below, stacks with every world.",
    },
    announce: {
      title: "Screen readers",
      body: "Every prompt, result and discovery is announced through a live region, and every control is labelled. The tutorial, all sheets and the whole game are reachable by keyboard.",
    },
    tutorial: {
      title: "The tour",
      body: "Your first Play offers a 20 second tour. Replay it any time from Settings, under Help.",
    },
    controls: {
      title: "Make it fit you",
      intro: "These controls are live. Flip them here and the game changes with you.",
      saveNote:
        "Changes apply instantly and are saved in this browser. To keep your settings on every device, create a free account from the menu in the game.",
    },
  },

  notFoundPage: {
    docTitle: "Uncharted territory · learnthe.world",
    codeAria: "Error 404, page not found",
    title: "Uncharted territory",
    lede: "This page isn't on any of our maps. The address may be mistyped, or the page may have sailed on without leaving a forwarding port.",
    pathIntro: "You charted a course for",
    home: "Back to the world",
  },

  loading: "Charting the oceans…",
  loadError: "The map couldn't load. Check your connection and refresh.",
} as const;
