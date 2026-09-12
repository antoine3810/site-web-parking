import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { COLORS, FOOTPRINT, NEIGHBOR_HEIGHT, TOTAL_HEIGHT } from "./buildingData.js";

/**
 * Crée le renderer WebGL avec les réglages de réalisme demandés :
 * ombres douces (PCF soft), tone mapping ACES, antialiasing,
 * pixelRatio plafonné à 2 pour les perfs.
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  // Brume atmosphérique pour la profondeur (montagnes en fond).
  scene.fog = new THREE.Fog(0xdbe7ee, 90, 320);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    600
  );
  camera.position.set(0, 8, 70);
  return camera;
}

/**
 * Éclairage image-based + soleil directionnel.
 * Tente de charger un HDRI réel (public/hdri/env.hdr) via HDRLoader +
 * PMREMGenerator pour des reflets crédibles sur le verre / les
 * panneaux solaires. Si aucun fichier n'est présent (cas par défaut du
 * dépôt), on retombe sur un environnement procédural (dégradé de ciel)
 * généré avec PMREMGenerator.fromScene, afin que le rendu reste correct
 * sans aucun asset externe à télécharger.
 *
 * -> Pour un rendu photoréaliste, dépose un HDRI libre (ex. Polyhaven
 *    "kloofendal_48d_partly_cloudy" ou "sky") dans public/hdri/env.hdr.
 *    Voir le README.
 */
export async function setupLighting(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  let envTexture = null;
  try {
    const hdrLoader = new HDRLoader();
    const texture = await hdrLoader.loadAsync("hdri/env.hdr");
    envTexture = pmrem.fromEquirectangular(texture).texture;
    texture.dispose();
  } catch (err) {
    envTexture = pmrem.fromScene(buildProceduralSky(), 0.02).texture;
  }
  scene.environment = envTexture;
  scene.background = envTexture;
  pmrem.dispose();

  // Soleil (lumière directionnelle) — ombres douces bien réglées.
  const sun = new THREE.DirectionalLight(0xfff2df, 3.1);
  sun.position.set(-38, 62, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xcfe4f2, 0x8b8272, 0.55);
  scene.add(hemi);

  return { sun, hemi };
}

/** Petite scène de ciel dégradé, utilisée uniquement pour générer un env map de secours. */
function buildProceduralSky() {
  const skyScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 24, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x8fb7e0) },
      bottom: { value: new THREE.Color(0xf3ede2) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top;
      uniform vec3 bottom;
      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
      }
    `,
  });
  skyScene.add(new THREE.Mesh(geo, mat));
  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(-1, 1, 0.5);
  skyScene.add(light);
  return skyScene;
}

/** Sol + contexte urbain : parcelle, quelques bâtiments voisins bas, montagnes en fond. */
export function buildContext(scene) {
  const group = new THREE.Group();

  const groundGeo = new THREE.CircleGeometry(220, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x9a9385,
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Parvis / enrobé autour du bâtiment.
  const apronGeo = new THREE.PlaneGeometry(FOOTPRINT.width + 40, FOOTPRINT.depth + 50);
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.9 });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.01;
  apron.receiveShadow = true;
  group.add(apron);

  // Bâtiment voisin réel : la Halle Alsthom (industrielle, faîtage +32,90 m).
  const neighbor = new THREE.Mesh(
    new THREE.BoxGeometry(34, NEIGHBOR_HEIGHT, 60),
    new THREE.MeshStandardMaterial({ color: 0xb0aca3, roughness: 0.85, metalness: 0.05 })
  );
  neighbor.position.set(-FOOTPRINT.width / 2 - 40, NEIGHBOR_HEIGHT / 2, -10);
  neighbor.castShadow = true;
  neighbor.receiveShadow = true;
  group.add(neighbor);

  // Petits bâtiments industriels bas complémentaires.
  const lowBuildingMat = new THREE.MeshStandardMaterial({ color: 0xc7c2b7, roughness: 0.9 });
  const positions = [
    [FOOTPRINT.width / 2 + 45, 7, 20, 26, 14, 30],
    [FOOTPRINT.width / 2 + 55, 5, -35, 20, 10, 22],
  ];
  for (const [x, y, z, w, h, d] of positions) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lowBuildingMat);
    b.position.set(x, y / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  }

  // Massif de Belledonne en fond : vraie photo panoramique (voir README).
  group.add(buildMountainBackdrop());

  scene.add(group);
  return group;
}

/**
 * Toile de fond photographique du massif de Belledonne, vue depuis le
 * site (public/images/panorama-belledonne.jpg — voir README pour la
 * remplacer). Un grand plan texturé et non éclairé (MeshBasicMaterial),
 * placé loin derrière le bâtiment ; `fog: false` car la photo porte déjà
 * sa propre brume atmosphérique — le brouillard procédural de la scène
 * la laverait sinon en une flaque de couleur unie à cette distance.
 */
function buildMountainBackdrop() {
  const photoWidth = 1000;
  const photoHeight = 562;
  const planeWidth = 1100;
  const planeHeight = planeWidth * (photoHeight / photoWidth);

  const material = new THREE.MeshBasicMaterial({ color: 0xdfe6ea, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), material);
  // Centré vers l'altitude moyenne des prises de vue de la caméra (4 -> 41 m)
  // pour que l'horizon de la photo tombe à peu près où la caméra regarde.
  mesh.position.set(0, 28, -260);

  new THREE.TextureLoader().load("images/panorama-belledonne.jpg", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    material.map = texture;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  });

  return mesh;
}
