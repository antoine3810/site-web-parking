import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { FOOTPRINT, TOTAL_HEIGHT } from "./buildingData.js";
import { placeCarOnRamp } from "./car.js";

gsap.registerPlugin(ScrollTrigger);

// ============================================================
// TIMELINE DE SCROLL — séquence exacte demandée (0 -> 1 = 0 -> 100%)
//
//   0.00 – 0.10  vue au sol, contre-plongée sur la parcelle / RDC
//   0.10 – 0.55  construction ascendante : les 7 plateaux + toiture
//                apparaissent un par un (stagger), cages rouges montent
//   0.30 – 0.55  la voiture grimpe la rampe hélicoïdale (roues au sol)
//   0.55 – 0.72  focus rooftop : panneaux photovoltaïques + terrasse verte
//   0.72 – 0.88  transition vers la salle de réunion vitrée du niveau 7
//   0.88 – 1.00  vue terrasse, panorama montagnes + CTA final
//
// Ajuste simplement les constantes ci-dessous pour changer le rythme.
// ============================================================
const PHASES = {
  groundEnd: 0.1,
  constructionStart: 0.1,
  constructionEnd: 0.55,
  carStart: 0.3,
  carEnd: 0.55,
  rooftopStart: 0.55,
  rooftopEnd: 0.72,
  meetingStart: 0.72,
  meetingEnd: 0.88,
  panoramaStart: 0.88,
  panoramaEnd: 1.0,
};

// Bornes d'affichage de chaque carte de texte (doit rester lisible pendant
// toute la phase correspondante).
const CARD_RANGES = [
  [0, 0.09],
  [0.11, 0.29],
  [0.3, 0.54],
  [0.56, 0.71],
  [0.73, 0.87],
  [0.89, 1.0],
];

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Points de passage de la caméra (position + cible) pour chaque phase clé. */
function cameraKeyframes() {
  const w = FOOTPRINT.width;
  const d = FOOTPRINT.depth;
  const h = TOTAL_HEIGHT;
  return [
    { p: 0.0, pos: [w * 0.55, 4.5, d * 0.9], look: [0, 4, 0] },
    { p: 0.1, pos: [w * 0.65, 8, d * 0.85], look: [0, 8, 0] },
    { p: 0.55, pos: [w * 1.05, h * 0.85, d * 1.15], look: [0, h * 0.55, 0] },
    { p: 0.72, pos: [w * 0.35, h + 9, d * 0.15], look: [0, h + 1, 0] },
    // La terrasse et la salle de réunion regardent vers -Z (nord), côté où
    // sont placées les montagnes (voir buildMountainBackdrop). Au point p=1.0 la
    // caméra est déjà au-delà du bord du bâtiment (au-dessus de son sommet)
    // pour ne jamais "plonger" dans la structure centrale (rampe/atrium).
    { p: 0.88, pos: [-w * 0.22, h + 4, -d * 0.28], look: [-w * 0.15, h + 2.5, -d * 0.75] },
    { p: 1.0, pos: [0, h + 7, -d * 0.62], look: [0, h + 3.5, -d * 4] },
  ];
}

function evaluateCamera(keyframes, p) {
  let a = keyframes[0];
  let b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].p && p <= keyframes[i + 1].p) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }
  const span = b.p - a.p || 1;
  const local = easeInOutCubic(clamp01((p - a.p) / span));
  const pos = a.pos.map((v, i) => THREE.MathUtils.lerp(v, b.pos[i], local));
  const look = a.look.map((v, i) => THREE.MathUtils.lerp(v, b.look[i], local));
  return { pos, look };
}

export function setupScroll({ scene, camera, levels, rooftop, structure, car, onReady }) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const keyframes = cameraKeyframes();

  if (reduceMotion) {
    setupStaticFallback({ camera, levels, rooftop, structure, car, keyframes, onReady });
    return { destroy() {} };
  }

  const lenis = new Lenis({ smoothWheel: true, duration: 1.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const perLevelReveal = 1 / (levels.length + 1);

  const trigger = ScrollTrigger.create({
    trigger: "#scene-scroll",
    start: "top top",
    end: "bottom bottom",
    scrub: 0.6,
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });

  function update(p) {
    // --- Caméra ---
    const { pos, look } = evaluateCamera(keyframes, p);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);

    // --- Structure centrale (cages rouges + atrium + rampe) : monte avec
    // le gros de la construction (10% -> 55%), pivot au sol.
    const span = PHASES.constructionEnd - PHASES.constructionStart;
    const structureLp = easeInOutCubic(clamp01((p - PHASES.constructionStart) / span));
    structure.scale.y = Math.max(structureLp, 0.001);
    structure.visible = structureLp > 0.001;

    // --- Construction ascendante des 7 plateaux (10% -> 55%) ---
    levels.forEach((level, i) => {
      const start = PHASES.constructionStart + i * perLevelReveal * span * 1.15;
      const duration = perLevelReveal * span * 1.7;
      const lp = easeInOutCubic(clamp01((p - start) / duration));
      level.scale.y = Math.max(lp, 0.001);
      level.visible = lp > 0.001;
    });
    // La toiture termine la construction juste après le dernier plateau.
    const roofStart = PHASES.constructionStart + levels.length * perLevelReveal * span * 1.15;
    const roofLp = easeInOutCubic(clamp01((p - roofStart) / (perLevelReveal * span * 1.7)));
    rooftop.scale.y = Math.max(roofLp, 0.001);
    rooftop.visible = roofLp > 0.001;

    // --- Voiture sur la rampe hélicoïdale (30% -> 55%) ---
    const carT = clamp01((p - PHASES.carStart) / (PHASES.carEnd - PHASES.carStart));
    placeCarOnRamp(car, easeInOutCubic(carT));
    car.visible = p > PHASES.constructionStart - 0.02;

    // --- Focus rooftop : PV + terrasse (55% -> 72%) ---
    const pv = rooftop.getObjectByName("pv-array");
    const vegetal = rooftop.getObjectByName("vegetal-terrace");
    const rp = clamp01((p - PHASES.rooftopStart) / (PHASES.rooftopEnd - PHASES.rooftopStart));
    if (pv) pv.scale.y = THREE.MathUtils.lerp(0.05, 1, easeInOutCubic(rp));
    if (vegetal) vegetal.scale.y = THREE.MathUtils.lerp(0.05, 1, easeInOutCubic(rp));

    // --- Cartes de texte ---
    updateCards(p);
  }

  update(0);
  onReady?.();

  return {
    destroy() {
      trigger.kill();
      lenis.destroy();
    },
  };
}

function updateCards(p) {
  const cards = document.querySelectorAll(".story-card");
  cards.forEach((card) => {
    const idx = Number(card.dataset.phase);
    const [start, end] = CARD_RANGES[idx];
    const visible = p >= start && p <= end;
    if (visible && card.dataset.visible !== "1") {
      card.dataset.visible = "1";
      gsap.to(card, { opacity: 1, y: 0, visibility: "visible", duration: 0.5, ease: "power2.out" });
    } else if (!visible && card.dataset.visible === "1") {
      card.dataset.visible = "0";
      gsap.to(card, {
        opacity: 0,
        y: 24,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          card.style.visibility = "hidden";
        },
      });
    }
  });
}

/**
 * Respect de prefers-reduced-motion : pas de scroll piloté ni de pin.
 * On affiche le bâtiment déjà construit, une caméra fixe, et les cartes
 * de texte s'enchaînent simplement au scroll natif (fade discret), sans
 * grosse animation 3D.
 */
function setupStaticFallback({ camera, levels, rooftop, structure, car, keyframes, onReady }) {
  levels.forEach((level) => {
    level.scale.y = 1;
    level.visible = true;
  });
  rooftop.scale.y = 1;
  rooftop.visible = true;
  structure.scale.y = 1;
  structure.visible = true;
  car.visible = true;
  placeCarOnRamp(car, 0.98);

  const { pos, look } = evaluateCamera(keyframes, 0.42);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(look[0], look[1], look[2]);

  document.getElementById("scene-scroll").style.height = "auto";
  document.getElementById("scene-pin").style.position = "relative";

  const cards = document.querySelectorAll(".story-card");
  cards.forEach((card, i) => {
    card.style.position = "static";
    card.style.opacity = "1";
    card.style.visibility = "visible";
    card.style.transform = "none";
    card.style.margin = "1rem auto";
    card.style.maxWidth = "560px";
  });

  onReady?.();
}
