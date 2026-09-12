// ============================================================
// Données réelles du bâtiment, extraites du DCE de l'architecte
// (Jean-Marc Mathieu Sarl — "Création d'un pôle de stationnements
// et extension d'un atelier de carrosserie", Lotissement Alstom,
// avenue Léon Blum, 38100 Grenoble — S.C.I. 3 A S M).
//
// Cotes d'étage (coupe AA / coupe BB, indice 9) :
//   RDC + Entresol ........ ±0,00  ->  +6,26
//   NIV 1  ................ +6,26  ->  +10,02
//   NIV 2  ................ +10,02 -> +13,08
//   NIV 3  ................ +13,08 -> +16,14
//   NIV 4  ................ +16,14 -> +19,20
//   NIV 5  ................ +19,20 -> +22,26
//   NIV 6  ................ +22,26 -> +25,46
//   NIV 7  ................ +25,46 -> +29,76
//   Toiture / acrotère .... +29,76 -> +32,00
//
// Rampe hélicoïdale centrale ajoutée en révision 5 (20-11-2025),
// rayon de courbure réel R = 15 m (adapté ici à un rayon de coeur
// de 9,5 m pour rester "grand cylindre central" dans l'emprise
// stylisée du bâtiment).
//
// Toiture : centrale photovoltaïque, surface en plan 1 940 m².
// Bâtiment voisin réel : "Halle Alsthom", faîtage +32,90 m.
// ============================================================

export const REAL_ELEVATIONS = [0, 6.26, 10.02, 13.08, 16.14, 19.2, 22.26, 25.46, 29.76, 32.0];

export const GROUND_HEIGHT = REAL_ELEVATIONS[1]; // 6.26 m (RDC + entresol)

// Hauteur de chaque plateau de parking (NIV1 -> NIV7)
export const LEVEL_HEIGHTS = [
  REAL_ELEVATIONS[2] - REAL_ELEVATIONS[1], // NIV1: 3.76
  REAL_ELEVATIONS[3] - REAL_ELEVATIONS[2], // NIV2: 3.06
  REAL_ELEVATIONS[4] - REAL_ELEVATIONS[3], // NIV3: 3.06
  REAL_ELEVATIONS[5] - REAL_ELEVATIONS[4], // NIV4: 3.06
  REAL_ELEVATIONS[6] - REAL_ELEVATIONS[5], // NIV5: 3.06
  REAL_ELEVATIONS[7] - REAL_ELEVATIONS[6], // NIV6: 3.20
  REAL_ELEVATIONS[8] - REAL_ELEVATIONS[7], // NIV7: 4.30 (inclut acrotère)
];

export const NUM_LEVELS = LEVEL_HEIGHTS.length; // 7
export const TOTAL_HEIGHT = REAL_ELEVATIONS[REAL_ELEVATIONS.length - 1]; // 32 m

export const FOOTPRINT = {
  width: 40, // m (axe X)
  depth: 46, // m (axe Z) — proche des 1 940 m² réels de toiture (~1 840 m²)
};

export const RAMP = {
  radius: 9.5,
  tubeRadius: 0.14,
  turns: NUM_LEVELS + 0.35,
  laneWidth: 5.2,
};

export const COLORS = {
  concrete: 0xcdc7bc,
  concreteDark: 0xb7b0a3,
  glass: 0x8fb9d6,
  red: 0xcf3b31,
  redDark: 0xa72e26,
  steel: 0x555a61,
  pvPanel: 0x1b2430,
  vegetal: 0x5c7a4c,
  road: 0x2f3136,
};

export const CONTACT = {
  phone: "+33476233337",
  phoneDisplay: "04 76 23 33 37",
  email: "direction@automobilite.com",
  address: "92 avenue Léon Blum, 38100 Grenoble",
};

export const CAPACITY = 518;
export const PV_AREA_M2 = 1940;
export const NEIGHBOR_HEIGHT = 32.9; // Halle Alsthom (bâtiment voisin réel)
