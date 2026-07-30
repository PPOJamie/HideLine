# Third-party notices

The MIT licence in `LICENSE` applies only to original HideLine source code and original visual assets in this repository.

## Supplied handbook

`docs/Hide-and-Seek-London-Handbook.pdf` was supplied as source material for this project. It is not covered by the HideLine MIT licence. Before making a public GitHub repository, confirm that you have the right to redistribute it. If not, remove the PDF and keep only a lawful link or private copy; the application can still run without the file, although the in-app handbook button will need updating.

## Google My Maps content

The configured map ID points to a user-provided Google My Maps layer. The map, boundary, labels and points remain subject to the map owner's rights and Google's terms. HideLine embeds/links the map but does not relicense its content.

## Transport and map data

- Transport for London names, status data and station information are provided by TfL and remain subject to TfL terms. Embedded station centres are planning coordinates and do not supersede the supplied authoritative map.
- OpenStreetMap map data and tiles are credited in the map interface and remain subject to OpenStreetMap/OpenStreetMap Foundation terms and the Open Database Licence where applicable.
- The built-in Thames side guide is a hand-curated aid used only for the north/south Landmass rule. It is not used as the Body of Water shoreline and is not a surveyed bank boundary.
- During GitHub Pages deployment, HideLine requests named water ways and multipolygons through an OpenStreetMap Overpass endpoint and publishes the returned snapshot with the app. The client converts mapped water polygons and banks into edge geometry, excludes pools and fountains, and clips the result to the supplied Game Area before use. That generated data remains © OpenStreetMap contributors and is available under the Open Database Licence. Width-derived canal/river banks, when no mapped area exists for the same name, are clearly marked as fallbacks rather than surveyed edges.
- Nominatim is used only as a fallback station geocoder and is subject to its usage policy.
- National Rail and linked service-status pages are external services with their own terms.
- London borough, electoral ward and Westminster parliamentary constituency polygons are requested from fixed Office for National Statistics ArcGIS FeatureServer layers. The datasets contain ONS and Ordnance Survey intellectual property and remain subject to the source notices and the Open Government Licence where applicable. HideLine caches only the Central London features needed for game play.

## Runtime libraries and CDNs

- Leaflet 1.9.4 is loaded from unpkg, runtime-cached after first use, and distributed under the BSD 2-Clause licence.
- Supabase JavaScript 2.x is loaded as an ES module bundle from esm.sh and is distributed under the MIT licence.

Review and pin/CDN-host these dependencies according to your deployment's supply-chain requirements.

## Names and affiliation

References to game formats, maps, publishers and transport services are descriptive. HideLine is an independent companion implementation and does not claim endorsement or official affiliation.
