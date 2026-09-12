import * as THREE from "three";
import { rampTransformAt } from "./ramp.js";

/** Petite voiture stylisée (low-poly) — suffisant à cette échelle de caméra. */
export function buildCar() {
  const group = new THREE.Group();
  group.name = "car";

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xcf3b31,
    roughness: 0.35,
    metalness: 0.6,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c2530,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.2,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.8), bodyMat);
  lowerBody.position.y = 0.55;
  lowerBody.castShadow = true;
  group.add(lowerBody);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), glassMat);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 14);
  const wheelPositions = [
    [-0.95, 0.32, 1.3],
    [0.95, 0.32, 1.3],
    [-0.95, 0.32, -1.3],
    [0.95, 0.32, -1.3],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  }

  return group;
}

/** Place la voiture sur la rampe pour une progression t dans [0, 1]. */
export function placeCarOnRamp(car, t) {
  const { x, y, z, heading, pitch } = rampTransformAt(t);
  car.position.set(x, y + 0.04, z);
  car.rotation.set(0, heading, 0);
  car.rotateX(-pitch);
}
