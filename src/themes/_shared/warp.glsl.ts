// Domain warping GLSL functions
// Implements 3-layer cascading warp for paint-like effects

/**
 * Decorrelation offsets - prevent directional artifacts
 * Uses IQ standard offsets
 */
export const warpOffsets = `
// Decorrelation offsets (IQ standard)
const vec2 OFFSET_1 = vec2(5.2, 1.3);
const vec2 OFFSET_2 = vec2(1.7, 9.2);
const vec2 OFFSET_3 = vec2(8.3, 2.8);
const vec2 OFFSET_4 = vec2(4.1, 3.7);
const vec2 OFFSET_5 = vec2(2.9, 7.1);
`;

/**
 * Animation drift using prime-ratio frequencies
 * Prevents visible repetition patterns
 */
export const animationDrift = `
// Prime-ratio drift for organic animation
vec2 getDrift(float time) {
  return vec2(
    sin(time * 0.13) * 0.3 + cos(time * 0.09) * 0.2,
    cos(time * 0.11) * 0.3 + sin(time * 0.07) * 0.2
  );
}

// Slower drift variant
vec2 getSlowDrift(float time) {
  return vec2(
    sin(time * 0.07) * 0.2 + cos(time * 0.05) * 0.15,
    cos(time * 0.06) * 0.2 + sin(time * 0.04) * 0.15
  );
}
`;

/**
 * Single warp layer
 */
export const singleWarp = `
// Basic domain warp - single layer
vec2 warpSingle(vec2 p, float strength) {
  vec2 warp = vec2(
    snoise(p),
    snoise(p + OFFSET_1)
  );
  return warp * strength;
}
`;

/**
 * 3-layer cascading domain warp
 * The core technique for paint-like effects
 */
export const cascadeWarp = `
// 3-layer cascading domain warp
// Each layer: higher frequency, lower strength, incorporates previous warps
vec2 warpCascade(vec2 p, float time) {
  vec2 drift = getDrift(time);

  // Layer 1: Large-scale folds (0.4 strength at 1.5x frequency)
  vec2 p1 = p * 1.5 + drift;
  vec2 w1 = vec2(
    snoise(p1),
    snoise(p1 + OFFSET_1)
  ) * 0.4;

  // Layer 2: Medium compression (0.25 strength at 2.5x frequency)
  // Uses w1 to create interdependence
  vec2 p2 = p * 2.5 + w1 + drift * 0.7;
  vec2 w2 = vec2(
    snoise(p2 + OFFSET_2),
    snoise(p2 + OFFSET_3)
  ) * 0.25;

  // Layer 3: Fine detail (0.12 strength at 4.0x frequency)
  // Uses w1 + w2 for complex folding
  vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
  vec2 w3 = vec2(
    snoise(p3 + OFFSET_4),
    snoise(p3 + OFFSET_5)
  ) * 0.12;

  // Return total warp offset
  return w1 + w2 + w3;
}

// Get warped position
vec2 getWarpedPosition(vec2 p, float time) {
  return p + warpCascade(p, time);
}
`;

/**
 * Configurable warp with custom parameters
 */
export const configurableWarp = `
// Configurable 3-layer warp
vec2 warpConfigurable(
  vec2 p,
  float time,
  float freq1, float str1,
  float freq2, float str2,
  float freq3, float str3
) {
  vec2 drift = getDrift(time);

  vec2 p1 = p * freq1 + drift;
  vec2 w1 = vec2(snoise(p1), snoise(p1 + OFFSET_1)) * str1;

  vec2 p2 = p * freq2 + w1 + drift * 0.7;
  vec2 w2 = vec2(snoise(p2 + OFFSET_2), snoise(p2 + OFFSET_3)) * str2;

  vec2 p3 = p * freq3 + w1 + w2 + drift * 0.5;
  vec2 w3 = vec2(snoise(p3 + OFFSET_4), snoise(p3 + OFFSET_5)) * str3;

  return w1 + w2 + w3;
}
`;

/**
 * All warp functions combined
 */
export const allWarp = `
${warpOffsets}
${animationDrift}
${singleWarp}
${cascadeWarp}
${configurableWarp}
`;
