import * as THREE from "three";
import {
  COLORS,
  FOOTPRINT,
  GROUND_HEIGHT,
  LEVEL_HEIGHTS,
  NUM_LEVELS,
  PV_AREA_M2,
  RAMP,
  TOTAL_HEIGHT,
} from "./buildingData.js";
import { buildRampGuardrailGeometry, buildRampRoadGeometry, RAMP_Y_END, RAMP_Y_START } from "./ramp.js";

const MULLION_SPACING = 2.1;

/**
 * Construit le bâtiment procédural complet (CAS B).
 * Retourne un groupe Three.js + des références utiles à l'animation
 * de scroll : les 7 plateaux (pour la construction ascendante) et
 * l'atrium/rampe (pour laisser passer la voiture visible en transparence).
 */
export function buildBuilding() {
  const building = new THREE.Group();
  building.name = "building";

  const materials = createMaterials();

  const ground = buildGround(materials);
  building.add(ground);

  // Cages rouges + atrium vitré + rampe : regroupés pour "monter" avec la
  // construction du bâtiment (scale.y piloté au scroll, pivot au sol).
  const structure = new THREE.Group();
  structure.name = "structure";
  const cores = buildRedCores(materials);
  structure.add(cores);
  const { atrium, rampMesh } = buildAtriumAndRamp(materials);
  structure.add(atrium);
  structure.add(rampMesh);
  building.add(structure);

  const mullionGeo = new THREE.BoxGeometry(0.08, 1, 0.08);
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.6 });

  const levels = [];
  let y = GROUND_HEIGHT;
  for (let i = 0; i < NUM_LEVELS; i++) {
    const h = LEVEL_HEIGHTS[i];
    const level = buildLevel(i, y, h, materials, mullionGeo, mullionMat);
    level.userData.baseY = level.position.y;
    levels.push(level);
    building.add(level);
    y += h;
  }

  const rooftop = buildRooftop(y, materials);
  building.add(rooftop);

  return { group: building, levels, rooftop, atrium, structure };
}

function createMaterials() {
  return {
    concrete: new THREE.MeshStandardMaterial({
      color: COLORS.concrete,
      roughness: 0.92,
      metalness: 0.02,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      color: COLORS.concreteDark,
      roughness: 0.88,
      metalness: 0.02,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: COLORS.glass,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.75,
      thickness: 0.4,
      ior: 1.4,
      envMapIntensity: 1.2,
      clearcoat: 0.3,
    }),
    atriumGlass: new THREE.MeshPhysicalMaterial({
      color: 0xdfeef5,
      roughness: 0.15,
      transmission: 0.92,
      thickness: 0.2,
      ior: 1.3,
      side: THREE.DoubleSide,
      envMapIntensity: 1,
    }),
    red: new THREE.MeshStandardMaterial({
      color: COLORS.red,
      roughness: 0.55,
      metalness: 0.15,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: COLORS.steel,
      roughness: 0.4,
      metalness: 0.85,
    }),
    road: new THREE.MeshStandardMaterial({
      color: COLORS.road,
      roughness: 0.95,
      metalness: 0,
    }),
    pv: new THREE.MeshStandardMaterial({
      color: COLORS.pvPanel,
      roughness: 0.25,
      metalness: 0.6,
    }),
    vegetal: new THREE.MeshStandardMaterial({
      color: COLORS.vegetal,
      roughness: 1,
    }),
  };
}

/** Rez-de-chaussée + entresol : atelier carrosserie / box, majoritairement massif avec accents rouges. */
function buildGround(materials) {
  const group = new THREE.Group();
  const { width, depth } = FOOTPRINT;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, GROUND_HEIGHT, depth),
    materials.concreteDark
  );
  base.position.y = GROUND_HEIGHT / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Bandeau vitré du guichet / accueil sur la façade principale (sud).
  const storefront = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.55, GROUND_HEIGHT * 0.55, 0.2),
    materials.glass
  );
  storefront.position.set(-width * 0.15, GROUND_HEIGHT * 0.55, depth / 2 + 0.11);
  group.add(storefront);

  // Portes de box "Boxland" en accent rouge, en bande basse.
  const doorCount = 6;
  const doorMat = materials.red;
  const doorGeo = new THREE.BoxGeometry(2.6, GROUND_HEIGHT * 0.7, 0.15);
  for (let i = 0; i < doorCount; i++) {
    const door = new THREE.Mesh(doorGeo, doorMat);
    const x = -width / 2 + 3 + i * ((width - 6) / (doorCount - 1));
    door.position.set(x, GROUND_HEIGHT * 0.35, -depth / 2 - 0.08);
    group.add(door);
  }

  return group;
}

/** Cages d'escalier et gaine ascenseur, en rouge signalétique, sur toute la hauteur. */
function buildRedCores(materials) {
  const group = new THREE.Group();
  const coreHeight = TOTAL_HEIGHT;
  const coreWidth = 3.4;
  const coreDepth = 4.2;

  const stairGeo = new THREE.BoxGeometry(coreWidth, coreHeight, coreDepth);
  const stair = new THREE.Mesh(stairGeo, materials.red);
  stair.position.set(FOOTPRINT.width / 2 - coreWidth / 2 + 0.4, coreHeight / 2, FOOTPRINT.depth / 2 - coreDepth / 2 - 1);
  stair.castShadow = true;
  stair.receiveShadow = true;
  group.add(stair);

  const elevatorGeo = new THREE.BoxGeometry(2.4, coreHeight, 2.4);
  const elevator = new THREE.Mesh(elevatorGeo, materials.red);
  elevator.position.set(FOOTPRINT.width / 2 - coreWidth / 2 + 0.4, coreHeight / 2, -FOOTPRINT.depth / 2 + 4);
  elevator.castShadow = true;
  elevator.receiveShadow = true;
  group.add(elevator);

  // Fines fentes vitrées verticales dans les cages rouges.
  const slitMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.3 });
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.15, coreHeight * 0.9, 0.4), slitMat);
  slit.position.set(stair.position.x + coreWidth / 2 + 0.01, coreHeight / 2, stair.position.z);
  group.add(slit);

  return group;
}

/** Atrium vitré central + route hélicoïdale (route + garde-corps). */
function buildAtriumAndRamp(materials) {
  const atriumRadius = RAMP.radius + RAMP.laneWidth / 2 + 1.4;
  const atrium = new THREE.Mesh(
    new THREE.CylinderGeometry(atriumRadius, atriumRadius, TOTAL_HEIGHT, 48, 1, true),
    materials.atriumGlass
  );
  atrium.position.y = TOTAL_HEIGHT / 2;

  const rampMesh = new THREE.Mesh(buildRampRoadGeometry({ segments: 480 }), materials.road);
  rampMesh.receiveShadow = true;
  rampMesh.castShadow = false;

  const railInner = new THREE.Mesh(
    buildRampGuardrailGeometry({ segments: 480, side: -1, height: 0.95 }),
    materials.steel
  );
  const railOuter = new THREE.Mesh(
    buildRampGuardrailGeometry({ segments: 480, side: 1, height: 0.95 }),
    materials.steel
  );
  rampMesh.add(railInner, railOuter);

  return { atrium, rampMesh };
}

/**
 * Construit un plateau de parking : dalle béton + coque vitrée (bandeau
 * horizontal) sur les 4 façades. Le niveau démarre "caché" (échelle nulle,
 * décalé vers le bas) pour l'animation de construction ascendante pilotée
 * au scroll — voir scroll.js.
 */
function buildLevel(index, y, height, materials, mullionGeo, mullionMat) {
  const group = new THREE.Group();
  group.name = `level-${index + 1}`;
  group.position.y = y;

  const { width, depth } = FOOTPRINT;
  const slabThickness = 0.35;

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, slabThickness, depth),
    materials.concrete
  );
  slab.position.y = slabThickness / 2;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const glassHeight = height - slabThickness - 0.35;
  const shellGeo = new THREE.BoxGeometry(width, glassHeight, depth);
  // Ordre des faces BoxGeometry : +x, -x, +y, -y, +z, -z
  const shellMaterials = [
    materials.glass,
    materials.glass,
    materials.concrete,
    materials.concrete,
    materials.glass,
    materials.glass,
  ];
  const shell = new THREE.Mesh(shellGeo, shellMaterials);
  shell.position.y = slabThickness + glassHeight / 2;
  shell.castShadow = false;
  shell.receiveShadow = true;
  group.add(shell);

  // Poutre de rive en béton sous chaque plateau (accent horizontal).
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3),
    materials.concreteDark
  );
  fascia.position.y = height - 0.15;
  group.add(fascia);

  // Meneaux de fenêtres verticaux, enfants du niveau : ils héritent
  // automatiquement de sa révélation (scale.y / visible) au scroll, un
  // seul InstancedMesh par niveau (pas d'update par frame nécessaire).
  const mullions = buildLevelMullions(width, depth, shell.position.y, glassHeight, mullionGeo, mullionMat);
  group.add(mullions);

  // Trou central pour l'atrium / la rampe hélicoïdale (le niveau "encercle" l'atrium).
  group.userData.hasAtriumHole = true;

  return group;
}

function buildLevelMullions(width, depth, centerY, glassHeight, geo, mat) {
  const spacingX = Math.floor(width / MULLION_SPACING);
  const spacingZ = Math.floor(depth / MULLION_SPACING);
  const total = (spacingX + spacingZ) * 2;
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.castShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  const place = (x, z) => {
    dummy.position.set(x, centerY, z);
    dummy.scale.set(1, glassHeight, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx++, dummy.matrix);
  };

  for (let i = 0; i < spacingX; i++) {
    const x = -width / 2 + i * MULLION_SPACING + MULLION_SPACING / 2;
    place(x, depth / 2);
    place(x, -depth / 2);
  }
  for (let i = 0; i < spacingZ; i++) {
    const z = -depth / 2 + i * MULLION_SPACING + MULLION_SPACING / 2;
    place(width / 2, z);
    place(-width / 2, z);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Rooftop : centrale photovoltaïque (1 940 m² réels), terrasse végétalisée, salle de réunion vitrée. */
function buildRooftop(y, materials) {
  const group = new THREE.Group();
  group.position.y = y;
  const { width, depth } = FOOTPRINT;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.4, depth), materials.concrete);
  slab.position.y = 0.2;
  slab.receiveShadow = true;
  slab.castShadow = true;
  group.add(slab);

  // Terrasse végétalisée, côté nord — face aux montagnes (voir buildMountainBackdrop
  // dans environment.js, placées en -Z pour le panorama final).
  const vegetal = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.9, 0.12, depth * 0.35),
    materials.vegetal
  );
  vegetal.name = "vegetal-terrace";
  vegetal.position.set(0, 0.46, -depth * 0.28);
  vegetal.receiveShadow = true;
  group.add(vegetal);

  // Salle de réunion vitrée, côté terrasse, ouverte sur les montagnes (nord).
  const meetingRoom = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.32, 3.1, depth * 0.16),
    materials.glass
  );
  meetingRoom.position.set(-width * 0.22, 0.4 + 1.55, -depth * 0.36);
  meetingRoom.castShadow = true;
  group.add(meetingRoom);
  const meetingRoof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.34, 0.15, depth * 0.18),
    materials.concreteDark
  );
  meetingRoof.position.set(meetingRoom.position.x, 0.4 + 3.1 + 0.08, meetingRoom.position.z);
  group.add(meetingRoof);

  // Centrale photovoltaïque : grille de panneaux inclinés sur structure acier (instanciée).
  const pv = buildPvArray(materials, width, depth);
  pv.position.y = 0.4;
  group.add(pv);

  // Garde-corps périphérique du toit.
  const railGeo = new THREE.BoxGeometry(width + 0.2, 1.0, 0.08);
  const railSide = new THREE.BoxGeometry(0.08, 1.0, depth + 0.2);
  const railMat = materials.steel;
  const railN = new THREE.Mesh(railGeo, railMat);
  railN.position.set(0, 0.9, depth / 2);
  const railS = new THREE.Mesh(railGeo, railMat);
  railS.position.set(0, 0.9, -depth / 2);
  const railE = new THREE.Mesh(railSide, railMat);
  railE.position.set(width / 2, 0.9, 0);
  const railW = new THREE.Mesh(railSide, railMat);
  railW.position.set(-width / 2, 0.9, 0);
  group.add(railN, railS, railE, railW);

  group.userData.pvAreaM2 = PV_AREA_M2;
  return group;
}

function buildPvArray(materials, width, depth) {
  const cols = 8;
  const rows = 10;
  const panelW = (width * 0.8) / cols;
  const panelD = (depth * 0.55) / rows;
  const geo = new THREE.BoxGeometry(panelW * 0.92, 0.06, panelD * 0.88);
  const mesh = new THREE.InstancedMesh(geo, materials.pv, cols * rows);
  mesh.name = "pv-array";
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  const startX = -width * 0.4 + panelW / 2;
  const startZ = -depth * 0.42 + panelD / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dummy.position.set(startX + c * panelW, 0.35 + Math.sin((c / cols) * 0) * 0, startZ + r * panelD);
      dummy.rotation.set(THREE.MathUtils.degToRad(18), 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

