// Domain Warping Fragment Shader
// Full glossy effect with 3-layer cascading domain warp
// Supports multiple color themes via u_colorTheme uniform

import { simplex2D } from '../../_shared/noise.glsl';

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
uniform float u_colorTheme;
varying vec2 vUv;

${simplex2D}

// === DECORRELATION OFFSETS (IQ standard) ===
const vec2 OFF1 = vec2(5.2, 1.3);
const vec2 OFF2 = vec2(1.7, 9.2);
const vec2 OFF3 = vec2(8.3, 2.8);
const vec2 OFF4 = vec2(4.1, 3.7);
const vec2 OFF5 = vec2(2.9, 7.1);

// === COLOR PALETTES ===

// Theme 0: NEON (magenta/purple/pink)
const vec3 neon_base = vec3(0.12, 0.08, 0.18);
const vec3 neon_deep = vec3(0.18, 0.08, 0.22);
const vec3 neon_mid1 = vec3(0.75, 0.28, 0.61);
const vec3 neon_mid2 = vec3(0.49, 0.35, 0.69);
const vec3 neon_mid3 = vec3(0.59, 0.18, 0.52);
const vec3 neon_accent = vec3(0.18, 0.27, 0.62);
const vec3 neon_highlight = vec3(0.79, 0.46, 0.61);
const vec3 neon_peak = vec3(0.89, 0.67, 0.90);

// Theme 1: OCEAN (deep blues/teals/cyans)
const vec3 ocean_base = vec3(0.02, 0.08, 0.15);
const vec3 ocean_deep = vec3(0.04, 0.12, 0.22);
const vec3 ocean_mid1 = vec3(0.08, 0.35, 0.55);
const vec3 ocean_mid2 = vec3(0.12, 0.45, 0.65);
const vec3 ocean_mid3 = vec3(0.05, 0.25, 0.45);
const vec3 ocean_accent = vec3(0.15, 0.55, 0.65);
const vec3 ocean_highlight = vec3(0.35, 0.75, 0.85);
const vec3 ocean_peak = vec3(0.65, 0.92, 0.98);

// Theme 2: EMBER (reds/oranges/yellows)
const vec3 ember_base = vec3(0.12, 0.04, 0.02);
const vec3 ember_deep = vec3(0.22, 0.06, 0.02);
const vec3 ember_mid1 = vec3(0.85, 0.25, 0.08);
const vec3 ember_mid2 = vec3(0.95, 0.45, 0.12);
const vec3 ember_mid3 = vec3(0.65, 0.12, 0.08);
const vec3 ember_accent = vec3(0.75, 0.35, 0.05);
const vec3 ember_highlight = vec3(0.98, 0.65, 0.15);
const vec3 ember_peak = vec3(1.0, 0.85, 0.45);

// Theme 3: AURORA (greens/teals/purples)
const vec3 aurora_base = vec3(0.02, 0.08, 0.12);
const vec3 aurora_deep = vec3(0.04, 0.15, 0.18);
const vec3 aurora_mid1 = vec3(0.15, 0.65, 0.45);
const vec3 aurora_mid2 = vec3(0.25, 0.75, 0.55);
const vec3 aurora_mid3 = vec3(0.35, 0.45, 0.65);
const vec3 aurora_accent = vec3(0.55, 0.35, 0.75);
const vec3 aurora_highlight = vec3(0.45, 0.85, 0.65);
const vec3 aurora_peak = vec3(0.75, 0.95, 0.85);

// Theme 4: VOID (deep blacks/purples/blues)
const vec3 void_base = vec3(0.02, 0.02, 0.04);
const vec3 void_deep = vec3(0.05, 0.03, 0.08);
const vec3 void_mid1 = vec3(0.15, 0.08, 0.25);
const vec3 void_mid2 = vec3(0.22, 0.12, 0.35);
const vec3 void_mid3 = vec3(0.08, 0.05, 0.18);
const vec3 void_accent = vec3(0.12, 0.15, 0.35);
const vec3 void_highlight = vec3(0.35, 0.25, 0.55);
const vec3 void_peak = vec3(0.55, 0.45, 0.75);

// === PALETTE INTERPOLATION ===
vec3 getBase(float theme) {
  if (theme < 1.0) return mix(neon_base, ocean_base, theme);
  if (theme < 2.0) return mix(ocean_base, ember_base, theme - 1.0);
  if (theme < 3.0) return mix(ember_base, aurora_base, theme - 2.0);
  return mix(aurora_base, void_base, theme - 3.0);
}

vec3 getDeep(float theme) {
  if (theme < 1.0) return mix(neon_deep, ocean_deep, theme);
  if (theme < 2.0) return mix(ocean_deep, ember_deep, theme - 1.0);
  if (theme < 3.0) return mix(ember_deep, aurora_deep, theme - 2.0);
  return mix(aurora_deep, void_deep, theme - 3.0);
}

vec3 getMid1(float theme) {
  if (theme < 1.0) return mix(neon_mid1, ocean_mid1, theme);
  if (theme < 2.0) return mix(ocean_mid1, ember_mid1, theme - 1.0);
  if (theme < 3.0) return mix(ember_mid1, aurora_mid1, theme - 2.0);
  return mix(aurora_mid1, void_mid1, theme - 3.0);
}

vec3 getMid2(float theme) {
  if (theme < 1.0) return mix(neon_mid2, ocean_mid2, theme);
  if (theme < 2.0) return mix(ocean_mid2, ember_mid2, theme - 1.0);
  if (theme < 3.0) return mix(ember_mid2, aurora_mid2, theme - 2.0);
  return mix(aurora_mid2, void_mid2, theme - 3.0);
}

vec3 getMid3(float theme) {
  if (theme < 1.0) return mix(neon_mid3, ocean_mid3, theme);
  if (theme < 2.0) return mix(ocean_mid3, ember_mid3, theme - 1.0);
  if (theme < 3.0) return mix(ember_mid3, aurora_mid3, theme - 2.0);
  return mix(aurora_mid3, void_mid3, theme - 3.0);
}

vec3 getAccent(float theme) {
  if (theme < 1.0) return mix(neon_accent, ocean_accent, theme);
  if (theme < 2.0) return mix(ocean_accent, ember_accent, theme - 1.0);
  if (theme < 3.0) return mix(ember_accent, aurora_accent, theme - 2.0);
  return mix(aurora_accent, void_accent, theme - 3.0);
}

vec3 getHighlight(float theme) {
  if (theme < 1.0) return mix(neon_highlight, ocean_highlight, theme);
  if (theme < 2.0) return mix(ocean_highlight, ember_highlight, theme - 1.0);
  if (theme < 3.0) return mix(ember_highlight, aurora_highlight, theme - 2.0);
  return mix(aurora_highlight, void_highlight, theme - 3.0);
}

vec3 getPeak(float theme) {
  if (theme < 1.0) return mix(neon_peak, ocean_peak, theme);
  if (theme < 2.0) return mix(ocean_peak, ember_peak, theme - 1.0);
  if (theme < 3.0) return mix(ember_peak, aurora_peak, theme - 2.0);
  return mix(aurora_peak, void_peak, theme - 3.0);
}

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

void main() {
  // Aspect-corrected coordinates centered at origin
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  float t = u_time * 0.25;

  // Get current palette colors
  float theme = clamp(u_colorTheme, 0.0, 4.0);
  vec3 baseColor = getBase(theme);
  vec3 deepColor = getDeep(theme);
  vec3 mid1 = getMid1(theme);
  vec3 mid2 = getMid2(theme);
  vec3 mid3 = getMid3(theme);
  vec3 accent = getAccent(theme);
  vec3 highlight = getHighlight(theme);
  vec3 peak = getPeak(theme);

  // === 1. DOMAIN WARP (3-layer cascade) ===
  vec2 warpedPos = domainWarp(p, t);

  // === 2. BASE INTENSITY FROM ORIGINAL COORDS (symmetry) ===
  float dist = length(p);
  float baseIntensity = smoothstep(1.3, 0.1, dist);

  // === 3. LARGE COLOR REGIONS FROM WARPED COORDS ===
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
  float zone1 = smoothstep(-0.1, 0.3, n1);
  float zone2 = smoothstep(0.2, -0.2, n1) * smoothstep(-0.2, 0.2, n2);
  float zone3 = smoothstep(-0.1, 0.4, n3) * smoothstep(0.3, -0.1, n1);
  float zone4 = smoothstep(0.0, -0.4, n1);
  float zone5 = smoothstep(0.1, -0.3, n2) * smoothstep(0.0, -0.3, n3);

  // Build color - start with base
  vec3 color = baseColor;

  // Layer colors with wide, breathing regions
  color = mix(color, deepColor, zone5 * 0.9);
  color = mix(color, mid3, zone4 * intensity);
  color = mix(color, accent, zone3 * intensity * 0.9);
  color = mix(color, mid2, zone2 * intensity);
  color = mix(color, mid1, zone1 * intensity);

  // Dark accent in fold intersections
  float foldDark = smoothstep(0.3, 0.6, n1 * n2);
  color = mix(color, deepColor, foldDark * 0.35);

  // === 7. SHARP HIGHLIGHTS (not diffuse glow) ===
  color = mix(color, highlight, caustics * 0.7);

  // Peak highlights on the sharpest peaks
  float sharpPeak = smoothstep(0.55, 0.8, causticNoise) * intensity;
  color = mix(color, peak, sharpPeak * 0.5);

  // === BOOST SATURATION ===
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.25);

  // === MINIMAL GRAIN ===
  float grain = fract(sin(dot(vUv * u_resolution + u_time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.015;

  gl_FragColor = vec4(color, u_opacity);
}
`;
