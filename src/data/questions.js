export const QUESTION_CATEGORIES = Object.freeze({
  matching: {
    id: "matching",
    name: "Matching",
    symbol: "match",
    responseSeconds: 300,
    reward: { draw: 3, keep: 1 },
    format: "Is your nearest ___ the same as ours?",
    answers: ["Yes", "No", "N/A"],
    colour: "purple"
  },
  measuring: {
    id: "measuring",
    name: "Measuring",
    symbol: "measure",
    responseSeconds: 300,
    reward: { draw: 3, keep: 1 },
    format: "Compared with me, are you closer to or farther from ___?",
    answers: ["Closer", "Farther", "N/A"],
    colour: "blue"
  },
  thermometer: {
    id: "thermometer",
    name: "Thermometer",
    symbol: "thermometer",
    responseSeconds: 300,
    reward: { draw: 2, keep: 1 },
    format: "I have just travelled at least ___ km. Am I hotter or colder?",
    answers: ["Hotter", "Colder"],
    colour: "orange"
  },
  radar: {
    id: "radar",
    name: "Radar",
    symbol: "radar",
    responseSeconds: 300,
    reward: { draw: 2, keep: 1 },
    format: "Are you within ___ km of me?",
    answers: ["Yes", "No"],
    colour: "mint"
  },
  tentacles: {
    id: "tentacles",
    name: "Tentacles",
    symbol: "tentacles",
    responseSeconds: 300,
    reward: { draw: 4, keep: 2 },
    format: "Of all the ___ within 2 km of me, which are you closest to?",
    answers: ["POI name"],
    colour: "yellow"
  },
  photos: {
    id: "photos",
    name: "Photos",
    symbol: "camera",
    responseSeconds: 600,
    reward: { draw: 1, keep: 1 },
    format: "Send a photo of ___",
    answers: ["Photo submitted", "I/we can't answer that"],
    colour: "red"
  }
});

const q = (id, category, name, prompt, guidance, options = {}) => Object.freeze({
  id,
  category,
  name,
  prompt,
  guidance,
  available: options.available ?? true,
  requiresPin: options.requiresPin ?? ["matching", "measuring", "radar", "tentacles"].includes(category),
  responseSeconds: options.responseSeconds ?? QUESTION_CATEGORIES[category].responseSeconds,
  reward: options.reward ?? QUESTION_CATEGORIES[category].reward,
  answers: options.answers ?? QUESTION_CATEGORIES[category].answers,
  customInput: options.customInput ?? false,
  photo: category === "photos",
  endgameFriendly: options.endgameFriendly ?? false,
  tags: options.tags ?? []
});

export const QUESTIONS = Object.freeze([
  q("matching-rail-line", "matching", "Transit rail line", "Does the moving train I am on stop at your hiding station?", "The seeker must be aboard a moving train, travel at least one stop and share the line/stops. Branches matter: that specific service must stop at the hiding station.", { tags: ["transit", "moving train"] }),
  q("matching-station-name", "matching", "Station name length", "Is your station name the same length as ours?", "Use the definitive hiding-station name. Spaces and punctuation each count as one character. When it does not match, the hider also says whether their name is longer or shorter.", { answers: ["Yes", "No - mine is longer", "No - mine is shorter"] }),
  q("matching-street", "matching", "Street or path", "Is your nearest street or path the same as ours?", "Use the name highlighted by the mapping app. Common abbreviations such as St, Pl and N/S/E/W are acceptable; give the benefit of the doubt."),
  q("matching-borough", "matching", "London borough", "Is your London borough the same as ours?", "Use the London borough boundary layer in the game map."),
  q("matching-constituency", "matching", "Parliamentary constituency", "Is your constituency the same as ours?", "Use the constituency layer in the game map."),
  q("matching-ward", "matching", "Electoral ward", "Is your electoral ward the same as ours?", "Use the electoral ward layer in the game map."),
  q("matching-landmass", "matching", "Landmass / Thames side", "Are you on the same landmass as us?", "Within this game boundary, treat this as north versus south of the River Thames. Bridges and tunnels count as matching both sides."),
  q("matching-park", "matching", "Nearest park", "Is your nearest mapped park the same as ours?", "Use the curated park points in the game map."),
  q("matching-zoo", "matching", "Nearest zoo", "Is your nearest mapped zoo the same as ours?", "Use the curated POI layer."),
  q("matching-museum", "matching", "Nearest museum", "Is your nearest mapped museum the same as ours?", "Use the curated POI layer."),
  q("matching-cinema", "matching", "Nearest movie theatre", "Is your nearest mapped movie theatre the same as ours?", "Use the curated POI layer."),
  q("matching-hospital", "matching", "Nearest hospital", "Is your nearest mapped hospital the same as ours?", "Use the curated POI layer."),
  q("matching-library", "matching", "Nearest library", "Is your nearest mapped library the same as ours?", "Use the curated POI layer."),
  q("matching-consulate", "matching", "Nearest foreign consulate", "Is your nearest mapped foreign consulate the same as ours?", "Use the curated POI layer."),

  q("measuring-high-speed", "measuring", "High-speed rail line", "Are you closer to or farther from the nearest mapped high-speed rail line than I am?", "Measure to the coloured high-speed lines in the railway layer."),
  q("measuring-station", "measuring", "Hiding rail station", "Are you closer to or farther from the nearest hiding-station pin than I am?", "Measure to the authoritative hiding-station pins, not a generic station label."),
  q("measuring-borough", "measuring", "London borough boundary", "Are you closer to or farther from the nearest London borough boundary than I am?", "Use the borough layer and the same measurement method for both locations."),
  q("measuring-altitude", "measuring", "Altitude / floor", "Are you higher or not higher than me?", "Outdoors, the seeker states altitude in metres. Indoors, compare floor numbers. If only ground elevation is available, estimate about 3 m per floor; equal floor means not higher.", { requiresPin: false, answers: ["Higher", "Not higher"] }),
  q("measuring-water", "measuring", "Body of water", "Are you closer to or farther from the nearest named body of water than I am?", "Measure to the nearest edge of a named blue-shaded body of water. Ignore swimming pools and fountains."),
  q("measuring-park", "measuring", "Park", "Are you closer to or farther from the nearest curated park than I am?", "Use the curated parks in the POI layer."),
  q("measuring-zoo", "measuring", "Zoo", "Are you closer to or farther from the nearest mapped zoo than I am?", "The handbook examples include London Zoo, Battersea Park Children's Zoo and Hackney City Farm."),
  q("measuring-aquarium", "measuring", "Aquarium", "Are you closer to or farther from Sea Life London Aquarium than I am?", "Use the aquarium pin in the POI layer."),
  q("measuring-museum", "measuring", "Museum", "Are you closer to or farther from the nearest mapped museum than I am?", "Use the curated POI layer."),
  q("measuring-cinema", "measuring", "Movie theatre", "Are you closer to or farther from the nearest mapped movie theatre than I am?", "Use the curated POI layer."),
  q("measuring-hospital", "measuring", "Hospital", "Are you closer to or farther from the nearest mapped hospital than I am?", "Use the curated POI layer."),
  q("measuring-library", "measuring", "Library", "Are you closer to or farther from the nearest mapped library than I am?", "Use the curated POI layer."),
  q("measuring-consulate", "measuring", "Foreign consulate", "Are you closer to or farther from the nearest mapped foreign consulate than I am?", "Use the curated POI layer."),

  q("thermometer-1", "thermometer", "1 km thermometer", "I have just travelled at least 1 km. Am I hotter or colder?", "Walking or rail transit is allowed. Compare the seeker's old and new positions with the hider's physical position at answer time.", { requiresPin: false, tags: ["1 km"] }),
  q("thermometer-5", "thermometer", "5 km thermometer", "I have just travelled at least 5 km. Am I hotter or colder?", "Walking or rail transit is allowed. Record both endpoints so the distance and direction are auditable.", { requiresPin: false, tags: ["5 km"] }),
  q("thermometer-15", "thermometer", "15 km thermometer", "I have just travelled at least 15 km. Am I hotter or colder?", "This is longer than the game's widest extent and may take the seeker well outside the boundary, but it remains available.", { requiresPin: false, tags: ["15 km"] }),

  q("radar-0-5", "radar", "500 m radar", "Are you within 500 m of me?", "Measure from the seeker's shared pin to the hider's current physical location.", { tags: ["500 m"] }),
  q("radar-1", "radar", "1 km radar", "Are you within 1 km of me?", "Measure from the seeker's shared pin to the hider's current physical location.", { tags: ["1 km"] }),
  q("radar-2", "radar", "2 km radar", "Are you within 2 km of me?", "Measure from the seeker's shared pin to the hider's current physical location.", { tags: ["2 km"] }),
  q("radar-5", "radar", "5 km radar", "Are you within 5 km of me?", "Measure from the seeker's shared pin to the hider's current physical location.", { tags: ["5 km"] }),
  q("radar-10", "radar", "10 km radar", "Are you within 10 km of me?", "Measure from the seeker's shared pin to the hider's current physical location.", { tags: ["10 km"] }),
  q("radar-custom", "radar", "Custom radar", "Are you within a custom distance of me?", "Choose a bespoke radius, for example 7.4 km. Record the radius in the question note.", { customInput: true, tags: ["custom"] }),

  q("tentacles-museums", "tentacles", "Museums", "Of all museums within 2 km of me, which are you closest to?", "The hider lists valid museum POIs within 2 km of the seeker's pinned location, then returns the one closest to the hider."),
  q("tentacles-libraries", "tentacles", "Libraries", "Of all libraries within 2 km of me, which are you closest to?", "Use the library POIs in the game map."),
  q("tentacles-cinemas", "tentacles", "Movie theatres", "Of all movie theatres within 2 km of me, which are you closest to?", "Use the movie theatre POIs in the game map."),
  q("tentacles-hospitals", "tentacles", "Hospitals", "Of all hospitals within 2 km of me, which are you closest to?", "Use the hospital POIs in the game map."),

  q("photo-tree", "photos", "A tree", "Send a photo of an entire tree.", "The complete tree should be visible.", { endgameFriendly: false }),
  q("photo-sky", "photos", "The sky / what is above", "Place the phone on the ground and photograph directly upwards.", "If indoors, photograph whatever is directly above.", { endgameFriendly: true }),
  q("photo-selfie", "photos", "A selfie", "Take a selfie with the arm fully extended and parallel to the ground.", "Repeated selfies should use a meaningfully different background, such as rotating around 120 degrees.", { endgameFriendly: true }),
  q("photo-widest-street", "photos", "Widest street or path", "Photograph both sides of the widest street or path you judge to be available.", "Road and pavements count. In endgame, use the widest visible option from the hiding spot.", { endgameFriendly: true }),
  q("photo-tallest-sightline", "photos", "Tallest structure in sightline", "Photograph the tallest permanent man-made structure visible from the current perspective.", "Include the top and both sides; place the top in the upper third of the frame.", { endgameFriendly: true }),
  q("photo-building-station", "photos", "Any building visible from station", "From directly outside a chosen entrance to the hiding station, photograph a visible building.", "Include the roof and both sides, with the top in the upper third of the frame."),
  q("photo-tallest-station", "photos", "Tallest building visible from station", "From directly outside a chosen station entrance, photograph the tallest building in the hider's sightline.", "Include the roof and both sides, with the top in the upper third."),
  q("photo-trace-path", "photos", "Trace nearest street or path", "Send a north-up drawing tracing the full mapped shape of the nearest street or path.", "Mark a clear north arrow and trace to the next intersection even if the street extends beyond the hiding zone."),
  q("photo-two-buildings", "photos", "Two buildings", "Photograph two buildings from the bottom through at least the first four storeys.", "For buildings of four storeys or fewer, include the roof.", { endgameFriendly: true }),
  q("photo-restaurant", "photos", "Restaurant interior", "Photograph a restaurant interior through the window from outside, without zoom.", "Do not enter solely to take the photo."),
  q("photo-platform", "photos", "Train platform", "From the platform at the hiding station, photograph a matchable view with at least three distinct elements.", "Cover roughly a 2 m by 2 m section and avoid an obscure corner."),
  q("photo-park", "photos", "Park", "Photograph a park without zoom, holding the phone perpendicular to the ground and about 2 m from obstructions.", "Use a fair, matchable composition."),
  q("photo-grocery", "photos", "Grocery-store aisle", "Stand at the end of an aisle and photograph directly down it without zoom.", "Avoid capturing people unnecessarily."),
  q("photo-worship", "photos", "Place of worship", "Photograph a roughly 2 m by 2 m section with three distinct elements.", "Keep the image matchable while respecting worshippers and site rules."),
  q("photo-field-view", "photos", "Your field of view", "At eye level in portrait orientation, use the main camera to photograph straight ahead without zoom.", "This custom question supports indoor hiding and can be answered from the final hiding spot.", { endgameFriendly: true })
]);

export const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

export const NOT_USED_QUESTIONS = Object.freeze([
  "Commercial airport (matching and measuring)",
  "First administrative division / Greater London",
  "Mountain",
  "Amusement park",
  "Golf course",
  "Aquarium matching",
  "International border",
  "Coastline",
  "15 km, 40 km, 80 km and 160 km fixed radar options"
]);

export function questionsForCategory(category = "all") {
  return category === "all" ? QUESTIONS : QUESTIONS.filter((question) => question.category === category);
}

export function questionOccurrence(questions, questionId) {
  return questions.filter((question) => question.questionId === questionId).length + 1;
}

export function repeatedReward(question, occurrence = 1, mode = "multiply-both") {
  const multiplier = Math.max(1, Number(occurrence) || 1);
  if (mode === "draw-only") return { draw: question.reward.draw * multiplier, keep: question.reward.keep, multiplier };
  if (mode === "manual") return { draw: question.reward.draw, keep: question.reward.keep, multiplier };
  return { draw: question.reward.draw * multiplier, keep: question.reward.keep * multiplier, multiplier };
}
