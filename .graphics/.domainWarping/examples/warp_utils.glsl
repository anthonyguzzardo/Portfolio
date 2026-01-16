// =============================================================================
// DOMAIN WARPING UTILITIES
// Reusable functions for domain warping effects
// =============================================================================

// -----------------------------------------------------------------------------
// SIMPLEX NOISE
// Preferred for warping - fewer directional artifacts than Perlin
// -----------------------------------------------------------------------------

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
// BASIC DOMAIN WARP
// Single layer warp - subtle organic distortion
// -----------------------------------------------------------------------------

vec2 basicWarp(vec2 p, float strength) {
    vec2 warp = vec2(
        snoise(p),
        snoise(p + vec2(5.2, 1.3))  // Decorrelation offset
    );
    return p + warp * strength;
}

// -----------------------------------------------------------------------------
// 3-LAYER CASCADE WARP
// Paint-like folding effect - the signature domain warp look
// Parameters: p = position, t = time, strength = overall intensity (0.5-1.0)
// -----------------------------------------------------------------------------

vec2 cascadeWarp(vec2 p, float t, float strength) {
    // Prime-ratio drift for non-repeating animation
    vec2 drift = vec2(
        sin(t * 0.13) * 0.3 + cos(t * 0.09) * 0.2,
        cos(t * 0.11) * 0.3 + sin(t * 0.07) * 0.2
    );

    // Layer 1: Large-scale folds (0.4 strength, 1.5x frequency)
    vec2 p1 = p * 1.5 + drift;
    vec2 w1 = vec2(
        snoise(p1),
        snoise(p1 + vec2(5.2, 1.3))
    ) * 0.4 * strength;

    // Layer 2: Medium compression (0.25 strength, 2.5x frequency)
    vec2 p2 = p * 2.5 + w1 + drift * 0.7;
    vec2 w2 = vec2(
        snoise(p2 + vec2(1.7, 9.2)),
        snoise(p2 + vec2(8.3, 2.8))
    ) * 0.25 * strength;

    // Layer 3: Fine detail (0.12 strength, 4.0x frequency)
    vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
    vec2 w3 = vec2(
        snoise(p3 + vec2(4.1, 3.7)),
        snoise(p3 + vec2(2.9, 7.1))
    ) * 0.12 * strength;

    return p + w1 + w2 + w3;
}

// -----------------------------------------------------------------------------
// CAUSTIC HIGHLIGHTS
// Shimmering refractive highlights like light through water/glass
// Returns 0.0-1.0 highlight intensity
// -----------------------------------------------------------------------------

float caustics(vec2 warpedPos, float t, float intensity) {
    float caustic = snoise(warpedPos * 3.0 + vec2(t * 0.1, t * 0.13));
    caustic = smoothstep(0.1, 0.7, caustic);
    return caustic * intensity * 0.5;
}

// -----------------------------------------------------------------------------
// WARP MODULATION
// Varies intensity based on warped domain - not uniform brightness
// Returns multiplier around 0.85 (range ~0.55-1.15)
// -----------------------------------------------------------------------------

float warpModulation(vec2 warpedPos) {
    return snoise(warpedPos * 1.5) * 0.3 + 0.85;
}

// -----------------------------------------------------------------------------
// MULTI-ACCENT COLOR MIX
// Blends 3 related colors for rich, glossy appearance
// -----------------------------------------------------------------------------

vec3 threeColorMix(vec3 accent1, vec3 accent2, vec3 accent3, vec2 warpedPos) {
    float colorNoise = snoise(warpedPos * 2.0 + vec2(1.5, 3.2)) * 0.5 + 0.5;
    return mix(accent1, mix(accent2, accent3, colorNoise), colorNoise * 0.7);
}

// -----------------------------------------------------------------------------
// FBM (Fractal Brownian Motion)
// Layered noise for clouds, terrain, organic textures
// -----------------------------------------------------------------------------

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

// -----------------------------------------------------------------------------
// ORGANIC REGIONS
// Creates paint-like region boundaries from warped coordinates
// Returns 0.0-1.0
// -----------------------------------------------------------------------------

float organicRegions(vec2 warpedPos) {
    float regions = snoise(warpedPos * 2.0) * 0.5 + 0.5;
    regions += snoise(warpedPos * 4.0 + vec2(3.1, 7.4)) * 0.25;
    return regions;
}
