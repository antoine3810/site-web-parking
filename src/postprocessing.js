import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// Léger vignettage pour renforcer la profondeur du rendu à l'écran.
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.85, 0.35, dist * (1.0 + amount));
      color.rgb *= mix(1.0 - amount, 1.0, vig);
      gl_FragColor = color;
    }
  `,
};

/**
 * EffectComposer : bloom léger + SSAO (désactivable sur machines faibles
 * via `enableSSAO=false`) + tone mapping ACES (géré par le renderer) +
 * vignette. `pixelRatio` est plafonné en amont par le renderer.
 */
export function createComposer(renderer, scene, camera, { enableSSAO = true } = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  if (enableSSAO) {
    const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssao.kernelRadius = 6;
    ssao.minDistance = 0.001;
    ssao.maxDistance = 0.15;
    composer.addPass(ssao);
  }

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // strength — léger
    0.6, // radius
    0.86 // threshold
  );
  composer.addPass(bloom);

  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);

  composer.addPass(new OutputPass());

  return composer;
}
