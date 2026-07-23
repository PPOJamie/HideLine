# Privacy notes

HideLine does not include advertising or analytics. The data path depends on the selected mode.

## Local Mode

Game state, profile, checklists and settings are stored in browser `localStorage`. Photo answers are compressed and stored separately in browser IndexedDB. Nothing is sent to a HideLine-operated server because no such server is included.

Map tiles, station lookup, line status and external map pages still contact their respective third-party services when used. Clearing the app in Settings removes HideLine's local state and local evidence store. Browser/site storage controls can also remove it.

## Connected Mode

Connected Mode uses the deployer's Supabase project and anonymous authentication. It stores:

- a room record and shared game state;
- display name, team, host flag and recent-presence time;
- timestamped game events;
- team-private station/card/note state;
- optional current positions;
- compressed photo evidence.

Row Level Security restricts room data to members, team state to the same team, and team-only positions to that team. Evidence is held in a private bucket and displayed using expiring signed URLs.

The room operator is responsible for retention, deletion, lawful basis, notices and handling access/deletion requests. The supplied migration does not automatically expire rooms or evidence.

## Location

The app requests browser geolocation only after a user chooses a location action. Continuous sharing is explicitly started and can be stopped. The latest remote position is deleted when sharing stops successfully. GPS accuracy can vary, especially indoors and underground; the app must not be used as an emergency tracking system.

## Photos

Players should avoid capturing strangers, addresses, access codes or other sensitive details. The game permits limited censorship of uniquely identifying text where needed. Local evidence is not embedded in exported JSON; connected evidence remains in the configured private bucket until removed under the operator's retention process.

## External services

Depending on the feature used, a browser may contact Google Maps/My Maps, Transport for London, OpenStreetMap tile servers, Nominatim, unpkg, esm.sh, Supabase and linked National Rail/TfL pages. Those services apply their own privacy terms and logs.
