// =============================================================================
// PAINT / FLUID
// Flowing paint effect using 3-layer cascade domain warping
//
// Technique: Full 3-layer cascade warp creates paint-like folding
// Result: Organic regions that expand, contract, and flow like wet paint
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
// The signature paint effect - recursive folding like kneading dough
// -----------------------------------------------------------------------------

vec2 paintWarp(vec2 p, float t) {
    // === PRIME-RATIO DRIFT ===
    // Non-repeating organic motion using prime frequency ratios
    vec2 drift = vec2(
        sin(t * 0.13) * 0.3 + cos(t * 0.09) * 0.2,
        cos(t * 0.11) * 0.3 + sin(t * 0.07) * 0.2
    );

    // === LAYER 1: LARGE FOLDS ===
    // Low frequency, high strength - creates broad organic regions
    vec2 p1 = p * 1.5 + drift;
    vec2 w1 = vec2(
        snoise(p1),
        snoise(p1 + vec2(5.2, 1.3))  // Decorrelation offset
    ) * 0.4;

    // === LAYER 2: MEDIUM COMPRESSION ===
    // Higher frequency, medium strength - adds compression zones
    // KEY: Uses w1, so folds get folded
    vec2 p2 = p * 2.5 + w1 + drift * 0.7;
    vec2 w2 = vec2(
        snoise(p2 + vec2(1.7, 9.2)),
        snoise(p2 + vec2(8.3, 2.8))
    ) * 0.25;

    // === LAYER 3: FINE DETAIL ===
    // Highest frequency, low strength - fine wrinkles
    // Uses w1 + w2, so wrinkles follow the folded structure
    vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
    vec2 w3 = vec2(
        snoise(p3 + vec2(4.1, 3.7)),
        snoise(p3 + vec2(2.9, 7.1))
    ) * 0.12;

    // Combine all warp layers
    return p + w1 + w2 + w3;
}

void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.5;

    // === DOMAIN WARP ===
    vec2 warped = paintWarp(p, t);

    // === ORGANIC REGIONS ===
    // Sample noise at warped position for paint-like regions
    float regions = snoise(warped * 2.0) * 0.5 + 0.5;

    // Add secondary detail layer
    regions += snoise(warped * 4.0 + vec2(3.1, 7.4)) * 0.25;

    // === PAINT COLORS ===
    // Define 4-5 colors for rich paint mixing
    vec3 color1 = vec3(0.9, 0.3, 0.2);   // Red-orange
    vec3 color2 = vec3(0.2, 0.5, 0.8);   // Blue
    vec3 color3 = vec3(0.95, 0.85, 0.4); // Yellow
    vec3 color4 = vec3(0.3, 0.7, 0.5);   // Teal
    vec3 color5 = vec3(0.95, 0.95, 0.9); // Off-white

    // === COLOR MIXING ===
    // Use different warped noise samples to drive color selection
    float mix1 = snoise(warped * 1.5) * 0.5 + 0.5;
    float mix2 = snoise(warped * 1.5 + vec2(7.3, 2.1)) * 0.5 + 0.5;
    float mix3 = snoise(warped * 2.0 + vec2(4.7, 8.3)) * 0.5 + 0.5;

    // Layer the color mixing for complex paint interaction
    vec3 colorA = mix(color1, color2, mix1);
    vec3 colorB = mix(color3, color4, mix2);
    vec3 paintColor = mix(colorA, colorB, mix3);

    // Add highlights with white
    paintColor = mix(paintColor, color5, smoothstep(0.6, 0.9, regions) * 0.4);

    // === PAINT THICKNESS ===
    // Subtle brightness variation suggests paint thickness
    float thickness = snoise(warped * 3.0) * 0.15 + 0.9;
    paintColor *= thickness;

    // === EDGE DARKENING ===
    // Slight darkening where paint regions meet (like real paint)
    float edges = abs(snoise(warped * 4.0));
    edges = smoothstep(0.0, 0.3, edges);
    paintColor *= mix(0.85, 1.0, edges);

    gl_FragColor = vec4(paintColor, 1.0);
}

// =============================================================================
// KEY PARAMETERS TO ADJUST:
//
// Warp layer strengths (0.4, 0.25, 0.12) - Higher = more dramatic folds
// Warp frequencies (1.5, 2.5, 4.0) - Higher = finer detail per layer
// Drift amplitude (0.3, 0.2) - Higher = more motion range
// Drift frequencies (0.13, 0.09, etc.) - Use primes to avoid repetition
// regions frequency (2.0, 4.0) - Controls size of paint regions
//
// VARIATIONS:
// - Oil paint: Increase thickness variation, add subtle specular
// - Watercolor: Reduce warp strength, add edge bleeding effect
// - Acrylic: Sharper region boundaries, more saturated colors
// - Ink in water: Single color, high warp strength, transparency
// =============================================================================
