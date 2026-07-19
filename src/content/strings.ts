/**
 * Every user-visible string in the app lives here so future translation
 * is a single-file effort. Functions are used where grammar needs values.
 */

export const STR = {
  appName: "Learning Globe",
  eyebrow: "Learning",
  wordmark: "Globe",
  tagline: "Spin the world. Pin your guess. Discover every country.",

  menu: {
    play: "Play",
    explore: "Explore the map",
    passport: "Passport",
    leaderboard: "High scores",
    settings: "Settings",
    regionLabel: "Where do you want to play?",
    roundsLabel: (n: number) => `${n} countries per round`,
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
    progress: (i: number, n: number) => `${i} of ${n}`,
    score: "Score",
    streakChip: (mult: number) => `streak ×${mult.toLocaleString()}`,
    hint: "Hint",
    skip: "Skip",
    pause: "Pause",
    quit: "Leave round",
    resume: "Keep playing",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    attemptsLeft: (n: number) => (n === 1 ? "Last try!" : `${n} tries left`),
    correct: ["Nailed it!", "Spot on!", "You got it!", "Brilliant!", "Cartographer!"],
    bullseye: "Bullseye!",
    discovery: "New discovery!",
    miss: (km: string, dir: string) => `${km} away — look ${dir}`,
    missWarm: "So close!",
    reveal: (name: string) => `It was ${name}`,
    revealSub: "Watch the glowing country — you'll know it next time.",
    accuracy: (pct: number) => `${pct}% to the heart`,
    speedFast: "Lightning fast",
    speedQuick: "Quick!",
    hintContinent: (c: string) => `It's in ${c}`,
    hintCapitalFlag: (flag: string, cap: string) =>
      cap ? `${flag} Its capital is ${cap}` : `Its flag is ${flag}`,
    hintFlash: "Watch the map closely…",
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
  },

  passport: {
    title: "Passport",
    progress: (found: number, total: number) => `${found} of ${total} countries discovered`,
    locked: "Not discovered yet",
    hintText: "Guess a country correctly for the first time to stamp it here.",
  },

  leaderboard: {
    title: "High scores",
    empty: "No scores yet — play a round and make history!",
    meta: (region: string, date: string) => `${region} · ${date}`,
  },

  settings: {
    title: "Settings",
    close: "Close",
    groupView: "Map & view",
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
    groupGame: "Game rules",
    roundLength: "Countries per round",
    attempts: "Tries per country",
    hintsEnabled: "Allow hints",
    speedBonus: "Speed bonus",
    speedBonusSub: "Extra points for fast answers",
    groupFeel: "Sound & feel",
    sound: "Sound effects",
    haptics: "Vibration",
    hapticsSub: "On supported phones",
    reduceMotion: "Reduce motion",
    reduceMotionSub: "Calmer animations",
    motionAuto: "Auto",
    motionOn: "On",
    motionOff: "Off",
    groupHelp: "Help",
    replayTutorial: "Show the tour again",
    keyboardTitle: "Keyboard controls",
    keyboardHelp:
      "Arrow keys move the map · + and − zoom · Enter drops your pin at the crosshair · H uses a hint · Esc pauses",
  },

  tutorial: {
    offerTitle: "First time here?",
    offerBody: "Want a 20-second tour before you play?",
    offerYes: "Show me",
    offerNo: "No thanks",
    steps: [
      {
        title: "Read the country name",
        body: "The card at the top tells you which country to find. No labels on the map — that's the game!",
      },
      {
        title: "Spin, zoom, and tap",
        body: "Drag to spin the world, pinch or use + / − to zoom, then tap where you think the country is. Anywhere inside it counts!",
      },
      {
        title: "Build your streak",
        body: "Every correct answer in a row doubles your points. First-ever finds go in your Passport. Stuck? Tap Hint.",
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
      `Not quite. Your pin is ${km} from the target. Try ${dir}. ${left} ${
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
  },

  loading: "Charting the oceans…",
  loadError: "The map couldn't load. Check your connection and refresh.",
} as const;
