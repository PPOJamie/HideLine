/**
 * River Thames planning centreline through the HideLine game area.
 *
 * The control points are anchored at major bridge crossings and follow the
 * intervening bends from Hammersmith to Rotherhithe. They are interpolated to
 * a maximum spacing of roughly 35 metres so both the vector map and the
 * north/south calculation use the same smooth guide.
 *
 * This is a game-planning aid, not a surveyed river-bank boundary. Borderline
 * bridge, tunnel, island and foreshore rulings should use the official game map
 * and the handbook's landmass guidance.
 *
 * Basemap reference and attribution: © OpenStreetMap contributors, ODbL.
 */

const THAMES_CONTROL_POINTS = Object.freeze([
  // Hammersmith bend to Putney Bridge.
  { lat: 51.48860, lng: -0.23600, halfWidthMetres: 88 },
  { lat: 51.48770, lng: -0.23100, halfWidthMetres: 90 },
  { lat: 51.48630, lng: -0.22483, halfWidthMetres: 92 }, // Hammersmith Bridge
  { lat: 51.48270, lng: -0.22270, halfWidthMetres: 94 },
  { lat: 51.47860, lng: -0.22095, halfWidthMetres: 96 },
  { lat: 51.47440, lng: -0.21890, halfWidthMetres: 98 },
  { lat: 51.47040, lng: -0.21645, halfWidthMetres: 100 },
  { lat: 51.46665, lng: -0.21339, halfWidthMetres: 100 }, // Putney Bridge

  // Putney's southward bend, Fulham Railway Bridge and Wandsworth.
  { lat: 51.46320, lng: -0.21020, halfWidthMetres: 100 },
  { lat: 51.46080, lng: -0.20770, halfWidthMetres: 100 },
  { lat: 51.45950, lng: -0.20583, halfWidthMetres: 100 }, // Fulham Railway Bridge
  { lat: 51.45910, lng: -0.20220, halfWidthMetres: 102 },
  { lat: 51.45940, lng: -0.19840, halfWidthMetres: 104 },
  { lat: 51.46050, lng: -0.19460, halfWidthMetres: 106 },
  { lat: 51.46230, lng: -0.19110, halfWidthMetres: 108 },
  { lat: 51.46500, lng: -0.18806, halfWidthMetres: 110 }, // Wandsworth Bridge

  // Wandsworth to the Battersea/Chelsea bend.
  { lat: 51.46730, lng: -0.18470, halfWidthMetres: 108 },
  { lat: 51.47020, lng: -0.18170, halfWidthMetres: 106 },
  { lat: 51.47306, lng: -0.17917, halfWidthMetres: 104 }, // Battersea Railway Bridge
  { lat: 51.47620, lng: -0.17730, halfWidthMetres: 104 },
  { lat: 51.47910, lng: -0.17510, halfWidthMetres: 106 },
  { lat: 51.48111, lng: -0.17250, halfWidthMetres: 108 }, // Battersea Bridge
  { lat: 51.48190, lng: -0.16950, halfWidthMetres: 110 },
  { lat: 51.48230, lng: -0.16670, halfWidthMetres: 112 }, // Albert Bridge
  { lat: 51.48320, lng: -0.16080, halfWidthMetres: 114 },
  { lat: 51.48410, lng: -0.15500, halfWidthMetres: 116 },
  { lat: 51.48472, lng: -0.15000, halfWidthMetres: 118 }, // Chelsea Bridge

  // Pimlico, Vauxhall and Westminster bends.
  { lat: 51.48470, lng: -0.14570, halfWidthMetres: 118 },
  { lat: 51.48480, lng: -0.13900, halfWidthMetres: 118 },
  { lat: 51.48510, lng: -0.13200, halfWidthMetres: 120 },
  { lat: 51.48580, lng: -0.12520, halfWidthMetres: 122 }, // Vauxhall Bridge
  { lat: 51.48930, lng: -0.12210, halfWidthMetres: 120 },
  { lat: 51.49456, lng: -0.12321, halfWidthMetres: 116 }, // Lambeth Bridge
  { lat: 51.49800, lng: -0.12280, halfWidthMetres: 112 },
  { lat: 51.50086, lng: -0.12179, halfWidthMetres: 110 }, // Westminster Bridge
  { lat: 51.50370, lng: -0.12100, halfWidthMetres: 108 },
  { lat: 51.50614, lng: -0.12005, halfWidthMetres: 106 }, // Hungerford bridges
  { lat: 51.50750, lng: -0.11850, halfWidthMetres: 106 },
  { lat: 51.50860, lng: -0.11690, halfWidthMetres: 106 }, // Waterloo Bridge

  // City bridges to Tower Bridge.
  { lat: 51.50940, lng: -0.11100, halfWidthMetres: 106 },
  { lat: 51.50977, lng: -0.10435, halfWidthMetres: 106 }, // Blackfriars bridges
  { lat: 51.51000, lng: -0.09865, halfWidthMetres: 108 }, // Millennium Bridge
  { lat: 51.50889, lng: -0.09406, halfWidthMetres: 112 }, // Southwark Bridge
  { lat: 51.50850, lng: -0.09100, halfWidthMetres: 116 },
  { lat: 51.50789, lng: -0.08784, halfWidthMetres: 122 }, // London Bridge
  { lat: 51.50680, lng: -0.08200, halfWidthMetres: 128 },
  { lat: 51.50555, lng: -0.07528, halfWidthMetres: 136 }, // Tower Bridge

  // Wapping and the Rotherhithe bend.
  { lat: 51.50450, lng: -0.07100, halfWidthMetres: 142 },
  { lat: 51.50340, lng: -0.06600, halfWidthMetres: 150 },
  { lat: 51.50180, lng: -0.06050, halfWidthMetres: 158 },
  { lat: 51.50030, lng: -0.05500, halfWidthMetres: 166 },
  { lat: 51.49920, lng: -0.04900, halfWidthMetres: 174 },
  { lat: 51.49870, lng: -0.04300, halfWidthMetres: 180 },
  { lat: 51.49880, lng: -0.03700, halfWidthMetres: 184 },
  { lat: 51.49960, lng: -0.03150, halfWidthMetres: 188 },
  { lat: 51.50100, lng: -0.02700, halfWidthMetres: 192 },
  { lat: 51.50220, lng: -0.02400, halfWidthMetres: 196 }
]);

function segmentDistanceMetres(a, b) {
  const meanLatRadians = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const north = (b.lat - a.lat) * 111_320;
  const east = (b.lng - a.lng) * 111_320 * Math.cos(meanLatRadians);
  return Math.hypot(east, north);
}

function interpolatePoint(a, b, progress) {
  return Object.freeze({
    lat: a.lat + (b.lat - a.lat) * progress,
    lng: a.lng + (b.lng - a.lng) * progress,
    halfWidthMetres: a.halfWidthMetres + (b.halfWidthMetres - a.halfWidthMetres) * progress
  });
}

function densify(points, maximumSegmentMetres = 35) {
  const line = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const steps = Math.max(1, Math.ceil(segmentDistanceMetres(start, end) / maximumSegmentMetres));
    for (let step = 0; step < steps; step += 1) line.push(interpolatePoint(start, end, step / steps));
  }
  line.push(Object.freeze({ ...points.at(-1) }));
  return line;
}

export const THAMES_CENTRELINE = Object.freeze(densify(THAMES_CONTROL_POINTS));

export const THAMES_DATA_ATTRIBUTION =
  "River Thames planning guide aligned to major crossings and the OpenStreetMap basemap. © OpenStreetMap contributors, ODbL.";
