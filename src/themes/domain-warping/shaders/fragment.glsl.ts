// Domain Warping Fragment Shader
// Full glossy effect with 3-layer cascading domain warp

import { simplex2D } from '../../_shared/noise.glsl';

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
varying vec2 vUv;

${simplex2D}

// === DECORRELATION OFFSETS (IQ standard) ===
const vec2 OFF1 = vec2(5.2, 1.3);
const vec2 OFF2 = vec2(1.7, 9.2);
const vec2 OFF3 = vec2(8.3, 2.8);
const vec2 OFF4 = vec2(4.1, 3.7);
const vec2 OFF5 = vec2(2.9, 7.1);

// === COLOR PALETTE (no blacks - deep colors as anchors) ===
// Darks (anchors) - rich, not black
const vec3 deepGreen = vec3(0.12, 0.22, 0.12);   // #1f391e
const vec3 deepTeal = vec3(0.08, 0.29, 0.22);    // #154a38
const vec3 darkBrown = vec3(0.27, 0.12, 0.11);   // #461f1d
const vec3 darkWine = vec3(0.42, 0.19, 0.22);    // #6b3038

// Saturated mids (the color)
const vec3 magenta = vec3(0.75, 0.28, 0.61);     // #bf479b
const vec3 burgundy = vec3(0.59, 0.18, 0.32);    // #972f52
const vec3 royalBlue = vec3(0.18, 0.27, 0.62);   // #2d449d
const vec3 purple = vec3(0.49, 0.35, 0.69);      // #7c59b0

// Luminous (highlights)
const vec3 pink = vec3(0.79, 0.46, 0.61);        // #c9769b
const vec3 lavender = vec3(0.79, 0.57, 0.80);    // #c991cc

// === PRIME-RATIO DRIFT (avoids visible repetition) ===
vec2 getDrift(float t) {
  return vec2(
    sin(t * 0.41) * 0.35 + cos(t * 0.31) * 0.25,
    cos(t * 0.37) * 0.35 + sin(t * 0.29) * 0.25
  );
}

// === 3-LAYER CASCADING DOMAIN WARP ===
vec2 domainWarp(vec2 p, float t) {
  vec2 drift = getDrift(t);

  // Layer 1: Large-scale folds (0.4 strength, 1.5x freq)
  vec2 p1 = p * 1.5 + drift;
  vec2 w1 = vec2(snoise(p1), snoise(p1 + OFF1)) * 0.4;

  // Layer 2: Medium compression (0.25 strength, 2.5x freq)
  vec2 p2 = p * 2.5 + w1 + drift * 0.7;
  vec2 w2 = vec2(snoise(p2 + OFF2), snoise(p2 + OFF3)) * 0.25;

  // Layer 3: Fine detail (0.12 strength, 4.0x freq)
  vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
  vec2 w3 = vec2(snoise(p3 + OFF4), snoise(p3 + OFF5)) * 0.12;

  // Return fully warped position
  return p + w1 + w2 + w3;
}

// === MULTI-ACCENT COLOR MIXING ===
vec3 accentMix(vec3 c1, vec3 c2, vec3 c3, float n) {
  float t = n * 0.5 + 0.5; // Normalize to 0-1
  return mix(c1, mix(c2, c3, t), t * 0.7);
}

void main() {
  // Aspect-corrected coordinates centered at origin
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  float t = u_time * 0.25;

  // === 1. DOMAIN WARP (3-layer cascade) ===
  vec2 warpedPos = domainWarp(p, t);

  // === 2. BASE INTENSITY FROM ORIGINAL COORDS (symmetry) ===
  float dist = length(p);
  float baseIntensity = smoothstep(1.3, 0.1, dist);

  // === 3. LARGE COLOR REGIONS FROM WARPED COORDS ===
  // Low frequencies = big expansive areas for each color
  float n1 = snoise(warpedPos * 0.7);
  float n2 = snoise(warpedPos * 0.9 + OFF1);
  float n3 = snoise(warpedPos * 0.6 + OFF2);

  // === 4. WARP MODULATION (subtle, not hazy) ===
  float warpMod = snoise(warpedPos * 0.5 + vec2(t * 0.3)) * 0.12 + 0.94;
  float intensity = baseIntensity * warpMod;

  // === 5. CAUSTIC HIGHLIGHTS (sharp, rare) ===
  float causticNoise = snoise(warpedPos * 2.5 + vec2(t * 0.4, t * 0.47));
  float caustics = smoothstep(0.4, 0.75, causticNoise) * intensity;

  // === 6. BUILD COLOR WITH WIDE REGIONS ===
  // Each color gets a big chunk of the noise range

  // Magenta dominates the positive range
  float magentaZone = smoothstep(-0.1, 0.3, n1);

  // Purple takes over in negative n1, positive n2
  float purpleZone = smoothstep(0.2, -0.2, n1) * smoothstep(-0.2, 0.2, n2);

  // Royal blue in its own region
  float blueZone = smoothstep(-0.1, 0.4, n3) * smoothstep(0.3, -0.1, n1);

  // Burgundy fills the deep negatives
  float burgundyZone = smoothstep(0.0, -0.4, n1);

  // Deep teal as grounding anchor
  float tealZone = smoothstep(0.1, -0.3, n2) * smoothstep(0.0, -0.3, n3);

  // Build color - start with deep green base
  vec3 color = deepGreen;

  // Layer colors with wide, breathing regions
  color = mix(color, deepTeal, tealZone * 0.9);
  color = mix(color, burgundy, burgundyZone * intensity);
  color = mix(color, royalBlue, blueZone * intensity * 0.9);
  color = mix(color, purple, purpleZone * intensity);
  color = mix(color, magenta, magentaZone * intensity);

  // Dark wine only in fold intersections
  float foldDark = smoothstep(0.3, 0.6, n1 * n2);
  color = mix(color, darkWine, foldDark * 0.35);

  // === 7. SHARP HIGHLIGHTS (not diffuse glow) ===
  // Pink highlights on caustic peaks
  color = mix(color, pink, caustics * 0.7);

  // Lavender only on the sharpest peaks
  float sharpPeak = smoothstep(0.55, 0.8, causticNoise) * intensity;
  color = mix(color, lavender, sharpPeak * 0.5);

  // === BOOST SATURATION ===
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.25); // Push saturation up

  // === VIGNETTE (to deep color, not darkness) ===
  float vignette = smoothstep(1.4, 0.4, dist);
  color = mix(deepGreen, color, vignette);

  // === MINIMAL GRAIN ===
  float grain = fract(sin(dot(vUv * u_resolution + u_time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.015;

  // === EDGE FADE ===
  float edgeFade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
  edgeFade *= smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);

  gl_FragColor = vec4(color, edgeFade * u_opacity);
}
`;
