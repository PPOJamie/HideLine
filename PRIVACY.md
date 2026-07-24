# Privacy notes

HideLine does not include advertising or analytics. The data path depends on the selected mode.

## Local Mode

Game state, profile, checklists, settings, imported simplified map geometry and the deduction/Endgame board are stored in browser `localStorage`. Photo answers are compressed and stored separately in browser IndexedDB. Nothing is sent to a HideLine-operated server because no such server is included.

Map tiles, line status and external map pages still contact their respective third-party services when used. Clearing the app in Settings removes HideLine's local state and local evidence store. Browser/site storage controls can also remove it.

## Connected Mode

Connected Mode uses the deployer's Supabase project and anonymous authentication. It stores:

- a room record and shared game state;
- display name, team, host flag and recent-presence time;
- timestamped game events;
- team-private station/card/note state;
- the team-private per-round deduction and Endgame board, including manual constraints, ignored automatic deductions, priority marks and station overrides;
- simplified KML/KMZ/GeoJSON geometry imported by that team for POI, boundary and Tentacle calculations;
- optional current positions;
- compressed photo evidence.

Row Level Security restricts room data to members, team state to the same team, and team-only positions to that team. Evidence is held in a private bucket and displayed using expiring signed URLs.

Structured question records are shared with game members. When a question is made map-ready, its seeker pin, travel endpoints, selected line/exact stops or Thames-side input may be included in that shared record because the information is part of asking and reproducing the question. The calculated elimination results, detailed cell masks and the seeker's private annotations are not written into shared game state. Masks are recalculated on the device from the private constraints and geometry.

The room operator is responsible for retention, deletion, lawful basis, notices and handling access/deletion requests. The supplied migration does not automatically expire rooms or evidence.

## Location

The app requests browser geolocation only after a user chooses a location action. Continuous sharing is explicitly started and can be stopped. The latest remote position is deleted when sharing stops successfully. GPS accuracy can vary, especially indoors and underground; the app must not be used as an emergency tracking system.

Using **Use GPS** in a deduction field copies one reading into the relevant question or private deduction constraint. It does not start continuous sharing by itself.

## Deduction data

The deduction engine evaluates station-centred 500 m zones using embedded planning coordinates and locally computed sample points/cells. Imported KML/KMZ/GeoJSON is simplified in the browser before storage. In Connected Mode that simplified geometry is sent to the deployer's Supabase project as team-private state so seeker team-mates receive the same calculations. It is not sent to an AI service. Before endgame, answers are deliberately treated as independent snapshots so the map does not create a false movement history for the hiders; locked Endgame answers are intersected at one fixed point.

Manual station marks can reveal a team's strategy. In Connected Mode they belong in the seeker's team-private state; players should not switch teams to inspect an opponent's private state.

## Photos

Players should avoid capturing strangers, addresses, access codes or other sensitive details. The game permits limited censorship of uniquely identifying text where needed. Local evidence is not embedded in exported JSON; connected evidence remains in the configured private bucket until removed under the operator's retention process.

## External services

Depending on the feature used, a browser may contact Google Maps/My Maps (including when attempting the configured public KML download), Transport for London, OpenStreetMap tile servers, Nominatim, unpkg, esm.sh, Supabase and linked National Rail/TfL pages. Those services apply their own privacy terms and logs.
