import * as THREE from "three";
import { RAMP, GROUND_HEIGHT, REAL_ELEVATIONS } from "./buildingData.js";

// La rampe hélicoïdale relie le rez-de-chaussée (accès véhicules, un peu
// au-dessus du sol) au sommet du niveau 7. Un seul point de vérité pour
// la géométrie de la rampe : utilisé à la fois pour construire la route
// (building.js) et pour positionner la voiture qui la gravit (car.js).
export const RAMP_Y_START = 0.4;
export const RAMP_Y_END = REAL_ELEVATIONS[8] - 0.6; // juste sous le niveau 7 (+29,76)

/**
 * Retourne la position + l'orientation (angle de lacet autour de Y et
 * pente locale) d'un point de la rampe pour t dans [0, 1].
 * La voiture posée à ce point a bien "les roues au sol de la rampe".
 */
export function rampTransformAt(t) {
  const angle = t * RAMP.turns * Math.PI * 2;
  const y = RAMP_Y_START + t * (RAMP_Y_END - RAMP_Y_START);
  const x = Math.cos(angle) * RAMP.radius;
  const z = Math.sin(angle) * RAMP.radius;

  // Dérivée numérique pour orienter la voiture dans le sens de la montée.
  const dt = 0.0005;
  const t2 = Math.min(1, t + dt);
  const angle2 = t2 * RAMP.turns * Math.PI * 2;
  const y2 = RAMP_Y_START + t2 * (RAMP_Y_END - RAMP_Y_START);
  const x2 = Math.cos(angle2) * RAMP.radius;
  const z2 = Math.sin(angle2) * RAMP.radius;

  const dx = x2 - x;
  const dz = z2 - z;
  const dy = y2 - y;
  const yaw = Math.atan2(dx, dz) + Math.PI / 2 * 0; // orientation le long de la tangente
  const heading = Math.atan2(-dz, dx); // angle utilisé pour lookAt-like rotation.y
  const horizontalDist = Math.hypot(dx, dz);
  const pitch = Math.atan2(dy, horizontalDist);

  return { x, y, z, angle, heading, pitch };
}

/** Construit le ruban de la route hélicoïdale (surface plane, pas un tube). */
export function buildRampRoadGeometry({ segments = 480 } = {}) {
  const half = RAMP.laneWidth / 2;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const { x, y, z, angle } = rampTransformAt(t);
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);

    // point intérieur / extérieur de la chaussée, perpendiculaire au rayon
    positions.push(x - nx * half, y, z - nz * half);
    positions.push(x + nx * half, y, z + nz * half);

    uvs.push(0, t * RAMP.turns * 4);
    uvs.push(1, t * RAMP.turns * 4);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Garde-corps intérieur/extérieur de la rampe (ruban fin surélevé). */
export function buildRampGuardrailGeometry({ segments = 480, side = 1, height = 1.0 } = {}) {
  const half = RAMP.laneWidth / 2 + 0.05;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const { x, y, z, angle } = rampTransformAt(t);
    const nx = Math.cos(angle) * side;
    const nz = Math.sin(angle) * side;

    positions.push(x + nx * half, y, z + nz * half);
    positions.push(x + nx * half, y + height, z + nz * half);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
