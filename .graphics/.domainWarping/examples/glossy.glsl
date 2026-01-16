// =============================================================================
// GLOSSY SURFACE
// Luxurious glossy effect combining domain warping + caustics + multi-accent color
//
// Technique: 3-layer warp + caustic highlights + warp modulation + color mixing
// Result: Rich, glossy, almost liquid-like surface with depth and shimmer
//
// This is the "beautiful" effect - the full combination of techniques
// =============================================================================

precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

// --- Include snoise from warp_utils.glsl ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// -----------------------------------------------------------------------------
// 3-LAYER CASCADE WARP
// Paint-like folding foundation
// -----------------------------------------------------------------------------

vec2 glossyWarp(vec2 p, float t) {
    // Prime-ratio drift
    vec2 drift = vec2(
        sin(t * 0.13) * 0.3 + cos(t * 0.09) * 0.2,
        cos(t * 0.11) * 0.3 + sin(t * 0.07) * 0.2
    );

    // Layer 1: Large folds
    vec2 p1 = p * 1.5 + drift;
    vec2 w1 = vec2(
        snoise(p1),
        snoise(p1 + vec2(5.2, 1.3))
    ) * 0.4;

    // Layer 2: Medium compression
    vec2 p2 = p * 2.5 + w1 + drift * 0.7;
    vec2 w2 = vec2(
        snoise(p2 + vec2(1.7, 9.2)),
        snoise(p2 + vec2(8.3, 2.8))
    ) * 0.25;

    // Layer 3: Fine detail
    vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
    vec2 w3 = vec2(
        snoise(p3 + vec2(4.1, 3.7)),
        snoise(p3 + vec2(2.9, 7.1))
    ) * 0.12;

    return p + w1 + w2 + w3;
}

// -----------------------------------------------------------------------------
// CAUSTIC HIGHLIGHTS
// Shimmering refractive highlights - the "glossy shimmer"
// -----------------------------------------------------------------------------

float caustics(vec2 warpedPos, float t, float intensity) {
    // Sample noise from warped domain with time offset
    float caustic = snoise(warpedPos * 3.0 + vec2(t * 0.1, t * 0.13));

    // Threshold to create bright spots, not gradients
    // smoothstep(0.1, 0.7) = only values above 0.1 show, fully bright at 0.7
    caustic = smoothstep(0.1, 0.7, caustic);

    // Scale by intensity so caustics only appear in lit areas
    return caustic * intensity * 0.5;
}

// -----------------------------------------------------------------------------
// WARP MODULATION
// Intensity variation based on warped domain - not uniform brightness
// -----------------------------------------------------------------------------

float warpModulation(vec2 warpedPos) {
    // Returns ~0.55-1.15 multiplier centered around 0.85
    return snoise(warpedPos * 1.5) * 0.3 + 0.85;
}

// -----------------------------------------------------------------------------
// MULTI-ACCENT COLOR MIX
// Rich color blending between 3 related tones
// -----------------------------------------------------------------------------

vec3 threeColorMix(vec3 a1, vec3 a2, vec3 a3, vec2 warpedPos) {
    float colorNoise = snoise(warpedPos * 2.0 + vec2(1.5, 3.2)) * 0.5 + 0.5;
    // Nested mix creates smooth transitions through all 3 colors
    return mix(a1, mix(a2, a3, colorNoise), colorNoise * 0.7);
}

void main() {
    vec2 uv = vUv;
    vec2 originalPos = (uv - 0.5) * 2.0;
    originalPos.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.5;
    float dist = length(originalPos);

    // === STEP 1: DOMAIN WARP ===
    vec2 warpedPos = glossyWarp(originalPos, t);

    // === STEP 2: BASE INTENSITY (from ORIGINAL coordinates) ===
    // This keeps the overall shape symmetrical/centered
    float breathe = sin(t * 0.8) * 0.04 + sin(t * 0.53) * 0.03;
    float blobSize = 0.45 + breathe;
    float baseIntensity = smoothstep(blobSize + 0.4, blobSize - 0.15, dist);

    // === STEP 3: ORGANIC REGIONS (from WARPED coordinates) ===
    float regions = snoise(warpedPos * 2.0) * 0.5 + 0.5;
    regions += snoise(warpedPos * 4.0 + vec2(3.1, 7.4)) * 0.25;

    // === STEP 4: WARP MODULATION ===
    float warpMod = warpModulation(warpedPos);

    // === STEP 5: COMBINED INTENSITY ===
    float intensity = baseIntensity * (0.5 + regions * 0.5) * warpMod;

    // === STEP 6: CAUSTIC HIGHLIGHTS ===
    float causticHighlights = caustics(warpedPos, t, intensity);

    // === STEP 7: MULTI-ACCENT COLOR ===
    // Warm palette: deep orange -> bright orange -> golden cream
    vec3 accent1 = vec3(0.878, 0.231, 0.075);  // Deep orange-red
    vec3 accent2 = vec3(0.988, 0.439, 0.165);  // Bright orange
    vec3 accent3 = vec3(0.980, 0.655, 0.353);  // Golden cream

    vec3 warmGlow = threeColorMix(accent1, accent2, accent3, warpedPos);

    // === STEP 8: BUILD FINAL COLOR ===
    vec3 baseColor = vec3(0.12, 0.08, 0.06);   // Dark warm brown
    vec3 liftedColor = vec3(0.22, 0.14, 0.10); // Lighter warm brown

    // Base gradient from dark to light
    vec3 color = mix(baseColor, liftedColor, intensity * 0.7);

    // Add warm glow
    color += warmGlow * intensity * 0.35;

    // Add caustic highlights (the glossy shimmer)
    color += warmGlow * causticHighlights * 0.4;

    // === STEP 9: VIGNETTE ===
    float vignette = 1.0 - smoothstep(0.4, 1.2, dist);
    color *= mix(0.4, 1.0, vignette);

    gl_FragColor = vec4(color, 1.0);
}

// =============================================================================
// THE GLOSSY RECIPE - WHY IT LOOKS BEAUTIFUL:
//
// 1. 3-layer cascade warp     -> Organic, paint-like foundation
// 2. Symmetrical base falloff -> Centered, intentional shape
// 3. Warped organic regions   -> Flowing, living variation
// 4. Warp modulation          -> Non-uniform brightness (depth)
// 5. Caustic highlights       -> Glossy shimmer like liquid/glass
// 6. Multi-accent colors      -> Rich color depth, not flat
// 7. Warm palette progression -> Deep -> bright -> cream feels luxurious
// 8. Vignette                 -> Focus and depth
//
// KEY PARAMETERS:
// - caustic smoothstep (0.1, 0.7) - Lower start = more highlights
// - warmGlow multiplier (0.35) - Higher = more color intensity
// - caustic multiplier (0.4) - Higher = more shimmer
// - accent colors - Try cool blues, or jewel tones
//
// VARIATIONS:
// - Cool glossy: accent1=deep blue, accent2=cyan, accent3=white
// - Jewel: accent1=deep purple, accent2=magenta, accent3=pink
// - Metallic: reduce caustics, increase warpMod range, add fresnel
// =============================================================================
