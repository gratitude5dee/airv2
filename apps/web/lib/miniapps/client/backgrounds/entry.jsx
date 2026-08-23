/**
 * Client entry for switchable mini-app backdrops. The shell renders
 * `<div id="wz-bg" data-effect="...">` and loads this bundle; only the chunk
 * for the chosen effect is downloaded (esbuild code splitting). Effects are
 * verbatim React Bits components under ./vendor, mounted full-bleed behind
 * the scrim. Props follow each component's documented example, color-tuned
 * to the air night-sky palette where the default is neon violet.
 */
import { createRoot } from "react-dom/client";

const AIR = ["#5392e1", "#8cc8ff", "#e0efff"];

const LOADERS = {
  "molten-metal": [
    () => import("./vendor/MoltenMetal.jsx"),
    { color1: AIR[0], color2: AIR[1], color3: AIR[2], speed: 0.3 },
  ],
  "liquid-ether": [
    () => import("./vendor/LiquidEther.jsx"),
    {
      colors: AIR,
      mouseForce: 20,
      cursorSize: 100,
      resolution: 0.5,
      autoDemo: true,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      autoResumeDelay: 3000,
      autoRampDuration: 0.6,
    },
  ],
  prism: [
    () => import("./vendor/Prism.jsx"),
    {
      animationType: "rotate",
      timeScale: 0.5,
      height: 3.5,
      baseWidth: 5.5,
      scale: 3.6,
      noise: 0.3,
      glow: 1,
    },
  ],
  silk: [
    () => import("./vendor/Silk.jsx"),
    { speed: 5, scale: 1, color: "#3a4f76", noiseIntensity: 1.5, rotation: 0 },
  ],
  "side-rays": [
    () => import("./vendor/SideRays.jsx"),
    {
      speed: 2.5,
      rayColor1: AIR[0],
      rayColor2: AIR[1],
      intensity: 2,
      spread: 2,
      origin: "top-right",
      saturation: 1.3,
      blend: 0.75,
      falloff: 1.6,
    },
  ],
  "light-rays": [
    () => import("./vendor/LightRays.jsx"),
    {
      raysOrigin: "top-center",
      raysColor: AIR[1],
      raysSpeed: 1.5,
      lightSpread: 0.8,
      rayLength: 1.2,
      followMouse: true,
      mouseInfluence: 0.1,
      noiseAmount: 0.1,
      distortion: 0.05,
    },
  ],
  grainient: [
    () => import("./vendor/Grainient.jsx"),
    {
      color1: AIR[1],
      color2: "#154b95",
      color3: AIR[0],
      timeSpeed: 0.25,
      warpStrength: 1,
      grainAmount: 0.1,
      contrast: 1.4,
      zoom: 0.9,
    },
  ],
  beams: [
    () => import("./vendor/Beams.jsx"),
    {
      beamWidth: 2,
      beamHeight: 15,
      beamNumber: 12,
      lightColor: AIR[2],
      speed: 2,
      noiseIntensity: 1.75,
      scale: 0.2,
      rotation: 25,
    },
  ],
  galaxy: [
    () => import("./vendor/Galaxy.jsx"),
    {
      mouseRepulsion: true,
      mouseInteraction: true,
      density: 1.2,
      glowIntensity: 0.4,
      saturation: 0.6,
      hueShift: 220,
    },
  ],
  dither: [
    () => import("./vendor/Dither.jsx"),
    {
      waveColor: [0.33, 0.48, 0.7],
      colorNum: 4,
      waveAmplitude: 0.3,
      waveFrequency: 3,
      waveSpeed: 0.05,
      enableMouseInteraction: true,
      mouseRadius: 0.3,
    },
  ],
  "faulty-terminal": [
    () => import("./vendor/FaultyTerminal.jsx"),
    {
      scale: 1.5,
      gridMul: [2, 1],
      digitSize: 1.2,
      timeScale: 0.8,
      scanlineIntensity: 0.8,
      glitchAmount: 1,
      flickerAmount: 1,
      noiseAmp: 1,
      tint: AIR[1],
      mouseReact: true,
      mouseStrength: 0.5,
      brightness: 0.8,
    },
  ],
  iridescence: [
    () => import("./vendor/Iridescence.jsx"),
    { color: [0.55, 0.7, 1], mouseReact: false, amplitude: 0.1, speed: 0.8 },
  ],
  "liquid-chrome": [
    () => import("./vendor/LiquidChrome.jsx"),
    { baseColor: [0.08, 0.13, 0.24], speed: 0.6, amplitude: 0.5, interactive: true },
  ],
};

// The vendor components size to their container; the shell's #wz-bg is the
// fixed full-bleed layer. Injected here so the shell CSS stays effect-free.
const style = document.createElement("style");
style.textContent =
  "#wz-bg>div{position:relative;width:100%;height:100%;overflow:hidden}#wz-bg canvas{display:block}";
document.head.appendChild(style);

const mount = document.getElementById("wz-bg");
const spec = mount ? LOADERS[mount.dataset.effect] : undefined;
if (mount && spec) {
  const [load, props] = spec;
  load().then(({ default: Effect }) => {
    createRoot(mount).render(<Effect {...props} />);
  });
}
