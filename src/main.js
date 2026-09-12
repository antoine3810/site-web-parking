import * as THREE from "three";
import { createCamera, createRenderer, createScene, buildContext, setupLighting } from "./environment.js";
import { buildBuilding } from "./building.js";
import { buildCar, placeCarOnRamp } from "./car.js";
import { createComposer } from "./postprocessing.js";
import { setupScroll } from "./scroll.js";

document.getElementById("year").textContent = new Date().getFullYear();

const canvas = document.getElementById("webgl");
const loader = document.getElementById("scene-loader");
const loaderBar = loader.querySelector(".loader-bar span");

const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();

setProgress(15);

buildContext(scene);
setProgress(35);

const { group: building, levels, rooftop, structure } = buildBuilding();
scene.add(building);
setProgress(60);

const car = buildCar();
car.castShadow = true;
scene.add(car);
placeCarOnRamp(car, 0);
setProgress(75);

let composer = null;
const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

setupLighting(renderer, scene).then(() => {
  composer = createComposer(renderer, scene, camera, { enableSSAO: !isLowPower });
  setProgress(100);
  hideLoader();

  setupScroll({
    scene,
    camera,
    levels,
    rooftop,
    structure,
    car,
    onReady: hideLoader,
  });

  renderLoop();
});

function setProgress(pct) {
  loaderBar.style.width = `${pct}%`;
}

function hideLoader() {
  loader.classList.add("is-hidden");
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  composer?.setSize(w, h);
});

// Rendu initial (avant que l'éclairage/HDRI ne soit prêt) pour éviter un
// écran noir pendant le chargement.
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.render(scene, camera);
