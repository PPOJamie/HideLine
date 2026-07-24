// Embedded station centres support the offline deduction map.
// Coordinates are planning aids; the handbook Google My Maps layer remains authoritative for rulings.

export const RAIL_LINES = Object.freeze([
  {
    "id": "bakerloo",
    "name": "Bakerloo line",
    "group": "London Underground"
  },
  {
    "id": "central",
    "name": "Central line",
    "group": "London Underground"
  },
  {
    "id": "circle",
    "name": "Circle line",
    "group": "London Underground"
  },
  {
    "id": "district",
    "name": "District line",
    "group": "London Underground"
  },
  {
    "id": "hammersmith-city",
    "name": "Hammersmith & City line",
    "group": "London Underground"
  },
  {
    "id": "jubilee",
    "name": "Jubilee line",
    "group": "London Underground"
  },
  {
    "id": "metropolitan",
    "name": "Metropolitan line",
    "group": "London Underground"
  },
  {
    "id": "northern",
    "name": "Northern line",
    "group": "London Underground"
  },
  {
    "id": "piccadilly",
    "name": "Piccadilly line",
    "group": "London Underground"
  },
  {
    "id": "victoria",
    "name": "Victoria line",
    "group": "London Underground"
  },
  {
    "id": "waterloo-city",
    "name": "Waterloo & City line",
    "group": "London Underground"
  },
  {
    "id": "elizabeth",
    "name": "Elizabeth line",
    "group": "TfL rail"
  },
  {
    "id": "dlr",
    "name": "Docklands Light Railway",
    "group": "TfL rail"
  },
  {
    "id": "windrush",
    "name": "Windrush line",
    "group": "London Overground"
  },
  {
    "id": "lioness",
    "name": "Lioness line",
    "group": "London Overground"
  },
  {
    "id": "weaver",
    "name": "Weaver line",
    "group": "London Overground"
  },
  {
    "id": "thameslink",
    "name": "Thameslink",
    "group": "National Rail"
  },
  {
    "id": "southeastern",
    "name": "Southeastern",
    "group": "National Rail"
  },
  {
    "id": "southern",
    "name": "Southern",
    "group": "National Rail"
  },
  {
    "id": "south-western",
    "name": "South Western Railway",
    "group": "National Rail"
  },
  {
    "id": "great-northern",
    "name": "Great Northern",
    "group": "National Rail"
  },
  {
    "id": "lner",
    "name": "LNER",
    "group": "National Rail"
  },
  {
    "id": "greater-anglia",
    "name": "Greater Anglia",
    "group": "National Rail"
  },
  {
    "id": "c2c",
    "name": "c2c",
    "group": "National Rail"
  },
  {
    "id": "chiltern",
    "name": "Chiltern Railways",
    "group": "National Rail"
  },
  {
    "id": "gwr",
    "name": "Great Western Railway",
    "group": "National Rail"
  },
  {
    "id": "heathrow-express",
    "name": "Heathrow Express",
    "group": "National Rail"
  },
  {
    "id": "avanti",
    "name": "Avanti West Coast",
    "group": "National Rail"
  },
  {
    "id": "west-midlands",
    "name": "West Midlands Trains",
    "group": "National Rail"
  },
  {
    "id": "caledonian-sleeper",
    "name": "Caledonian Sleeper",
    "group": "National Rail"
  },
  {
    "id": "east-midlands",
    "name": "East Midlands Railway",
    "group": "National Rail"
  },
  {
    "id": "eurostar",
    "name": "Eurostar",
    "group": "International rail"
  },
  {
    "id": "gatwick-express",
    "name": "Gatwick Express",
    "group": "National Rail"
  }
]);

export const STATION_GEO = Object.freeze([
  {
    "id": "aldgate",
    "lat": 51.513982,
    "lng": -0.074236,
    "lines": [
      "circle",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "aldgate-east",
    "lat": 51.514917,
    "lng": -0.06954,
    "lines": [
      "district",
      "hammersmith-city"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "angel",
    "lat": 51.53098,
    "lng": -0.103116,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "baker-street",
    "lat": 51.522494,
    "lng": -0.155454,
    "lines": [
      "bakerloo",
      "circle",
      "hammersmith-city",
      "jubilee",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "bank-station",
    "lat": 51.512915,
    "lng": -0.087297,
    "lines": [
      "central",
      "dlr",
      "northern",
      "waterloo-city"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "barbican",
    "lat": 51.519699,
    "lng": -0.09719,
    "lines": [
      "circle",
      "hammersmith-city",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "battersea-park",
    "lat": 51.4773,
    "lng": -0.1482,
    "lines": [
      "southern"
    ],
    "source": "handbook station pin"
  },
  {
    "id": "battersea-power-station",
    "lat": 51.479932,
    "lng": -0.142142,
    "lines": [
      "northern"
    ],
    "source": "TfL station data"
  },
  {
    "id": "bayswater",
    "lat": 51.511815,
    "lng": -0.186323,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "bermondsey",
    "lat": 51.49719,
    "lng": -0.062746,
    "lines": [
      "jubilee"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "blackfriars",
    "lat": 51.511114,
    "lng": -0.10202,
    "lines": [
      "circle",
      "district",
      "thameslink"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "bond-street",
    "lat": 51.51387,
    "lng": -0.148077,
    "lines": [
      "central",
      "elizabeth",
      "jubilee"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "borough",
    "lat": 51.50068,
    "lng": -0.091703,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "brixton-1",
    "lat": 51.462151,
    "lng": -0.113289,
    "lines": [
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "brixton-2",
    "lat": 51.463,
    "lng": -0.1141,
    "lines": [
      "southeastern"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "camden-town",
    "lat": 51.538724,
    "lng": -0.141017,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "canada-water",
    "lat": 51.497408,
    "lng": -0.048372,
    "lines": [
      "jubilee",
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "cannon-street",
    "lat": 51.510963,
    "lng": -0.088801,
    "lines": [
      "circle",
      "district",
      "southeastern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "chancery-lane",
    "lat": 51.517739,
    "lng": -0.109961,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "charing-cross",
    "lat": 51.506868,
    "lng": -0.125777,
    "lines": [
      "bakerloo",
      "northern",
      "southeastern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "city-thameslink",
    "lat": 51.5141,
    "lng": -0.1035,
    "lines": [
      "thameslink"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "clapham-common",
    "lat": 51.461695,
    "lng": -0.135589,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "clapham-high-street",
    "lat": 51.465031,
    "lng": -0.131145,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "clapham-north",
    "lat": 51.465214,
    "lng": -0.127754,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "covent-garden",
    "lat": 51.512635,
    "lng": -0.12276,
    "lines": [
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "denmark-hill",
    "lat": 51.467582,
    "lng": -0.088015,
    "lines": [
      "southeastern",
      "thameslink"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "earl-s-court",
    "lat": 51.491473,
    "lng": -0.191577,
    "lines": [
      "district",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "edgware-road-1",
    "lat": 51.519961,
    "lng": -0.168646,
    "lines": [
      "bakerloo"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "edgware-road-2",
    "lat": 51.519364,
    "lng": -0.166171,
    "lines": [
      "circle"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "elephant-castle-1",
    "lat": 51.4942,
    "lng": -0.0986,
    "lines": [
      "southeastern",
      "thameslink"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "elephant-castle-2",
    "lat": 51.495325,
    "lng": -0.099577,
    "lines": [
      "bakerloo",
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "embankment",
    "lat": 51.506941,
    "lng": -0.120562,
    "lines": [
      "bakerloo",
      "circle",
      "district",
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "euston",
    "lat": 51.527577,
    "lng": -0.132992,
    "lines": [
      "avanti",
      "caledonian-sleeper",
      "northern",
      "victoria",
      "west-midlands"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "euston-square",
    "lat": 51.525125,
    "lng": -0.134271,
    "lines": [
      "circle",
      "hammersmith-city",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "farringdon",
    "lat": 51.519961,
    "lng": -0.103582,
    "lines": [
      "circle",
      "hammersmith-city",
      "metropolitan",
      "thameslink"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "fenchurch-street",
    "lat": 51.5115,
    "lng": -0.0789,
    "lines": [
      "c2c"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "gloucester-road",
    "lat": 51.493978,
    "lng": -0.182135,
    "lines": [
      "circle",
      "district",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "goodge-street",
    "lat": 51.520093,
    "lng": -0.132737,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "great-portland-street",
    "lat": 51.523338,
    "lng": -0.142686,
    "lines": [
      "circle",
      "hammersmith-city",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "green-park",
    "lat": 51.506357,
    "lng": -0.140937,
    "lines": [
      "jubilee",
      "piccadilly",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "high-street-kensington",
    "lat": 51.499935,
    "lng": -0.190607,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "holborn",
    "lat": 51.517069,
    "lng": -0.118809,
    "lines": [
      "central",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "holland-park",
    "lat": 51.506644,
    "lng": -0.204063,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "hoxton",
    "lat": 51.530938,
    "lng": -0.074056,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "hyde-park-corner",
    "lat": 51.502241,
    "lng": -0.152546,
    "lines": [
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "kennington",
    "lat": 51.487827,
    "lng": -0.104357,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "king-s-cross",
    "lat": 51.529277,
    "lng": -0.123168,
    "lines": [
      "circle",
      "great-northern",
      "hammersmith-city",
      "lner",
      "metropolitan",
      "northern",
      "piccadilly",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "knightsbridge",
    "lat": 51.500731,
    "lng": -0.159864,
    "lines": [
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "lambeth-north",
    "lat": 51.498331,
    "lng": -0.110625,
    "lines": [
      "bakerloo"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "lancaster-gate",
    "lat": 51.511178,
    "lng": -0.173844,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "leicester-square",
    "lat": 51.510895,
    "lng": -0.126726,
    "lines": [
      "northern",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "liverpool-street",
    "lat": 51.516842,
    "lng": -0.081601,
    "lines": [
      "central",
      "circle",
      "greater-anglia",
      "hammersmith-city",
      "metropolitan"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "london-bridge",
    "lat": 51.504554,
    "lng": -0.088038,
    "lines": [
      "jubilee",
      "northern",
      "southeastern",
      "southern",
      "thameslink"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "loughborough-junction",
    "lat": 51.4667,
    "lng": -0.1025,
    "lines": [
      "thameslink"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "mansion-house",
    "lat": 51.511306,
    "lng": -0.092495,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "marble-arch",
    "lat": 51.513091,
    "lng": -0.155756,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "marylebone",
    "lat": 51.521651,
    "lng": -0.162637,
    "lines": [
      "bakerloo",
      "chiltern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "monument",
    "lat": 51.510209,
    "lng": -0.084502,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "moorgate",
    "lat": 51.517853,
    "lng": -0.0877,
    "lines": [
      "circle",
      "great-northern",
      "hammersmith-city",
      "metropolitan",
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "mornington-crescent",
    "lat": 51.534198,
    "lng": -0.137143,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "nine-elms",
    "lat": 51.479933,
    "lng": -0.12845,
    "lines": [
      "northern"
    ],
    "source": "station centre"
  },
  {
    "id": "notting-hill-gate",
    "lat": 51.508647,
    "lng": -0.194491,
    "lines": [
      "central",
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "old-street",
    "lat": 51.524576,
    "lng": -0.086025,
    "lines": [
      "great-northern",
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "oval",
    "lat": 51.481324,
    "lng": -0.110799,
    "lines": [
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "oxford-circus",
    "lat": 51.51481,
    "lng": -0.140025,
    "lines": [
      "bakerloo",
      "central",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "paddington",
    "lat": 51.514995,
    "lng": -0.173789,
    "lines": [
      "bakerloo",
      "circle",
      "district",
      "gwr",
      "hammersmith-city",
      "heathrow-express"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "peckham-rye",
    "lat": 51.469779,
    "lng": -0.067331,
    "lines": [
      "southeastern",
      "southern",
      "thameslink"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "piccadilly-circus",
    "lat": 51.509551,
    "lng": -0.132081,
    "lines": [
      "bakerloo",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "pimlico",
    "lat": 51.48857,
    "lng": -0.132104,
    "lines": [
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "queens-road-peckham",
    "lat": 51.473105,
    "lng": -0.055828,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "queenstown-road",
    "lat": 51.4748,
    "lng": -0.147,
    "lines": [
      "south-western"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "queensway",
    "lat": 51.509743,
    "lng": -0.185538,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "regent-s-park",
    "lat": 51.52277,
    "lng": -0.144708,
    "lines": [
      "bakerloo"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "rotherhithe",
    "lat": 51.500538,
    "lng": -0.05051,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "russell-square",
    "lat": 51.522551,
    "lng": -0.122662,
    "lines": [
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "shadwell-1",
    "lat": 51.5107,
    "lng": -0.055366,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "shadwell-2",
    "lat": 51.511182,
    "lng": -0.05513,
    "lines": [
      "dlr"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "shoreditch-high-street",
    "lat": 51.522855,
    "lng": -0.0747,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "sloane-square",
    "lat": 51.491825,
    "lng": -0.154733,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "south-bermondsey",
    "lat": 51.488136,
    "lng": -0.054678,
    "lines": [
      "southern"
    ],
    "source": "TfL station data"
  },
  {
    "id": "south-kensington",
    "lat": 51.493577,
    "lng": -0.171564,
    "lines": [
      "circle",
      "district",
      "piccadilly"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "southwark",
    "lat": 51.503776,
    "lng": -0.103788,
    "lines": [
      "jubilee"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "st-james-s-park",
    "lat": 51.49905,
    "lng": -0.132022,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "st-pancras-international",
    "lat": 51.5313,
    "lng": -0.126,
    "lines": [
      "east-midlands",
      "eurostar",
      "thameslink"
    ],
    "source": "station centre"
  },
  {
    "id": "st-paul-s",
    "lat": 51.514443,
    "lng": -0.095908,
    "lines": [
      "central"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "stockwell",
    "lat": 51.471314,
    "lng": -0.121437,
    "lines": [
      "northern",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "surrey-quays",
    "lat": 51.492828,
    "lng": -0.046056,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "temple",
    "lat": 51.510474,
    "lng": -0.112644,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "tottenham-court-road",
    "lat": 51.515948,
    "lng": -0.128897,
    "lines": [
      "central",
      "elizabeth",
      "northern"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "tower-gateway",
    "lat": 51.51011,
    "lng": -0.073062,
    "lines": [
      "dlr"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "tower-hill",
    "lat": 51.509434,
    "lng": -0.074914,
    "lines": [
      "circle",
      "district"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "vauxhall",
    "lat": 51.485184,
    "lng": -0.122646,
    "lines": [
      "south-western",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "victoria",
    "lat": 51.49589,
    "lng": -0.141485,
    "lines": [
      "circle",
      "district",
      "gatwick-express",
      "southeastern",
      "southern",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "wandsworth-road",
    "lat": 51.469431,
    "lng": -0.136927,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "wapping",
    "lat": 51.503866,
    "lng": -0.054346,
    "lines": [
      "windrush"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "warren-street",
    "lat": 51.524019,
    "lng": -0.136736,
    "lines": [
      "northern",
      "victoria"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "waterloo",
    "lat": 51.502914,
    "lng": -0.112819,
    "lines": [
      "bakerloo",
      "jubilee",
      "northern",
      "south-western",
      "waterloo-city"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "waterloo-east",
    "lat": 51.5041,
    "lng": -0.1086,
    "lines": [
      "southeastern"
    ],
    "source": "National Rail station centre"
  },
  {
    "id": "westminster",
    "lat": 51.500453,
    "lng": -0.124052,
    "lines": [
      "circle",
      "district",
      "jubilee"
    ],
    "source": "TfL station locations dataset"
  },
  {
    "id": "whitechapel",
    "lat": 51.519022,
    "lng": -0.059154,
    "lines": [
      "district",
      "hammersmith-city",
      "windrush"
    ],
    "source": "TfL station locations dataset"
  }
]);

export const STATION_GEO_BY_ID = new Map(STATION_GEO.map((station) => [station.id, station]));
export const RAIL_LINE_BY_ID = new Map(RAIL_LINES.map((line) => [line.id, line]));

export function stationsForLine(lineId) {
  return STATION_GEO.filter((station) => station.lines.includes(lineId)).map((station) => station.id);
}
