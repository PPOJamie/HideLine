export const SCHEDULE = Object.freeze({
  round1: [
    { time: "08:30", title: "Meet", detail: "Meet at the location agreed in the group chat." },
    { time: "08:30-08:55", title: "Pre-game preparation", detail: "Rules recap, choose first hiders, set seeker trackers and hand over physical game materials." },
    { time: "08:55", title: "Walk to the start", detail: "Both teams move to the agreed station entrance or start point." },
    { time: "09:00", title: "Round 1 starts", detail: "Start the round clock and the hiders' 45-minute hiding period." },
    { time: "09:45", title: "Seekers released", detail: "Hiders must be in a valid 500 m station-centred hiding zone." },
    { time: "09:45-13:45", title: "Core gameplay", detail: "Seekers investigate until the hiders are found or the cutoff is reached." },
    { time: "13:45", title: "Round cutoff and admin", detail: "Stop timers, record bonuses and penalties, then regroup for lunch." }
  ],
  round2: [
    { time: "13:45-14:30", title: "Regroup and lunch", detail: "Meet at the first hiding station or a mutually useful central start." },
    { time: "14:30-14:45", title: "Pre-round preparation", detail: "Swap materials, set trackers and give the second hiders time to plan." },
    { time: "14:45", title: "Round 2 starts", detail: "Start the round clock and the second 45-minute hiding period." },
    { time: "15:30", title: "Seekers released", detail: "Second hiders must be inside a valid hiding zone." },
    { time: "15:30-19:30", title: "Core gameplay", detail: "Seekers investigate until found or cutoff." },
    { time: "19:30", title: "Final admin and debrief", detail: "Add final times and regroup for a debrief." }
  ]
});

export const QUICK_RULES = Object.freeze({
  hider: [
    "Anchor the hiding zone to one valid, open hiding station and know its exact handbook name.",
    "Be inside the 500 m radius when the 45-minute hiding period ends; otherwise pause, backtrack to the last valid stop and take the 30-minute score reduction.",
    "After release, stay inside the hiding zone unless a game mechanic explicitly permits otherwise.",
    "Before endgame you may move around the zone and answer using your physical location at answer time.",
    "Endgame begins when seekers are in the hiding zone and off transit; remain at the hiding spot until found, unless they leave by transit after an accidental trigger.",
    "You are found when seekers are within 2 m and have spotted you.",
    "Answer normal questions within 5 minutes and photo questions within 10 minutes. Late answers require a pause and give no reward.",
    "The default card hand limit is six, unless a power-up or curse changes it.",
    "For curses, send enough detail for the seekers to resolve the effect. No more than one active curse may block questions and no more than one may block transit.",
    "Photos may censor only uniquely identifying text, and should remain matchable in person. Endgame photos that require movement may be answered with 'I/we can't answer that'."
  ],
  seeker: [
    "Ask only one question at a time; after it is answered, another may be asked immediately.",
    "Repeated questions incur an increasing cost: second use x2, third use x3, and so on.",
    "Share a pin at your current location for matching, measuring, radar and tentacle questions so you may move while the hider calculates.",
    "Tell hiders before boarding and after leaving a train. Share the starting station before going underground, where live location may fail.",
    "For rail-line matching, be on a moving train, share the intended line/stops and travel at least one stop.",
    "Google Street View, reverse-image search and AI tools are banned for solving the hiding location.",
    "Treat matching or measuring targets outside the game area as non-existent; for example, coastline is N/A.",
    "A difficult curse may be cured only with hider agreement, granting the hiders a 45-minute time bonus.",
    "Use train or walking only during active rounds. Seekers may use rail routes outside the boundary where useful.",
    "Record time-trap removal as soon as the trapped station is passed through or visited."
  ],
  both: [
    "Public transport means train services or travel on foot during active play. Other modes may be used between rounds.",
    "Hiding spots must be publicly accessible throughout both rounds and either within 3 m of a mapped path/street or inside a public building whose entrance meets that test.",
    "If a photo would force the hider to move while seekers are within 10 minutes of the zone, the hider may call a pause, take the photo and return to the hiding spot.",
    "Use WhatsApp or the in-app timeline as the timestamp record for questions, pauses, transit and traps.",
    "When a rule is ambiguous, stop and share enough information for both teams to agree a fair interpretation.",
    "Do not hide where you will obstruct people, breach site rules, lose signal for long periods or create a safety risk."
  ]
});

export const CHECKLISTS = Object.freeze({
  pregame: [
    "Phone fully charged",
    "Portable charger and cable packed",
    "Water and food packed",
    "Weather layers / rain protection packed",
    "Oyster/contactless ready and sufficient balance available",
    "Google Maps set to kilometres and metres",
    "Offline map downloaded where useful",
    "Planned station and line closures checked",
    "Group chat and emergency contact confirmed",
    "Location permissions tested",
    "Physical cards, dice, map, ruler, compass and stationery packed"
  ],
  hider: [
    "Chosen station is valid, open and reasonably accessible",
    "Final station name and service variant confirmed",
    "Station coordinates resolved in the app",
    "Inside 500 m zone before release",
    "Public, all-day-accessible final hiding spot selected",
    "Phone signal checked",
    "Useful non-endgame photos captured in advance where allowed",
    "Card hand and hand limit recorded"
  ],
  seeker: [
    "Starting pin shared before first question",
    "Transit-intent buttons ready before going underground",
    "Map boundary and POI layers open",
    "Investigation tools and measuring method agreed",
    "Question history checked before repeating a question",
    "Potential hiding stations and excluded areas recorded"
  ]
});

export const GLOSSARY = Object.freeze([
  { term: "Hiding zone", definition: "A 500 m radius around the chosen valid hiding station. Hiders may move within it until endgame." },
  { term: "Hiding spot", definition: "The specific public place where hiders stay once endgame begins." },
  { term: "Hiding period", definition: "The first 45 minutes of a round, used to reach a valid hiding zone." },
  { term: "Hiding time", definition: "Active time from the end of the hiding period until found, excluding pauses." },
  { term: "Total hiding time", definition: "The scored hiding time after traps, percentage bonuses, time bonuses, curse effects, cures and penalties." },
  { term: "Total round time", definition: "Total hiding time plus the 45-minute hiding period; this is used to compare rounds." },
  { term: "Endgame", definition: "The period after seekers enter the hiding zone off transit, when hiders remain in their hiding spot." },
  { term: "Time trap", definition: "A hider card effect that earns time based on its placement and seeker activation/removal timestamps." }
]);

export const CARD_TYPES = Object.freeze([
  { id: "time", name: "Time bonus", description: "Adds a fixed amount to scored hiding time." },
  { id: "percentage", name: "Percentage bonus", description: "Multiplies hiding time plus activated time traps." },
  { id: "powerup", name: "Power-up", description: "A special action such as veto, randomise or hand expansion." },
  { id: "curse", name: "Curse", description: "A challenge imposed on seekers after paying the stated cost." },
  { id: "custom", name: "Custom card", description: "A numbered custom curse or house card resolved from your live card folder." }
]);

export const SAFETY_NOTES = Object.freeze([
  "Keep attention on traffic, platform edges and other people; stop walking before interacting with the app.",
  "Location sharing is opt-in, foreground-only and can be stopped at any time.",
  "Do not enter restricted, private, unsafe or closed spaces, and comply immediately with staff instructions.",
  "Avoid photographing strangers, children, security infrastructure or sensitive interiors.",
  "Use an agreed real-world emergency channel. This app is not an emergency or safeguarding service."
]);
