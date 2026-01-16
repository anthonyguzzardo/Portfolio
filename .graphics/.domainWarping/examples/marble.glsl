// =============================================================================
// MARBLE TEXTURE
// Classic marble veins using domain warping + sine waves
//
// Technique: Warp coordinates, then use warped noise to distort sine stripes
// Result: Organic, flowing vein patterns like real marble
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
// MARBLE-SPECIFIC WARP
// 2-layer warp optimized for vein patterns
// -----------------------------------------------------------------------------

vec2 marbleWarp(vec2 p, float t) {
    // Slow drift for subtle animation
    vec2 drift = vec2(sin(t * 0.05) * 0.1, cos(t * 0.07) * 0.1);

    // Layer 1: Large vein folds
    vec2 w1 = vec2(
        snoise(p * 1.0 + drift),
        snoise(p * 1.0 + drift + vec2(5.2, 1.3))
    ) * 0.5;

    // Layer 2: Medium detail
    vec2 w2 = vec2(
        snoise(p * 2.0 + w1 + vec2(1.7, 9.2)),
        snoise(p * 2.0 + w1 + vec2(8.3, 2.8))
    ) * 0.25;

    return p + w1 + w2;
}

void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0; // Center and scale
    p.x *= uResolution.x / uResolution.y; // Aspect correction

    float t = uTime * 0.3;

    // === DOMAIN WARP ===
    vec2 warped = marbleWarp(p, t);

    // === MARBLE VEINS ===
    // The key: use warped noise to distort sine wave stripes
    float veinNoise = snoise(warped * 3.0) * 5.0;

    // Sine stripes distorted by warped noise = marble veins
    // veinFrequency controls stripe density
    float veinFrequency = 8.0;
    float veins = sin(p.x * veinFrequency + veinNoise);

    // Sharpen veins with abs + smoothstep
    veins = abs(veins);
    veins = smoothstep(0.0, 0.4, veins);

    // === SECONDARY VEINS ===
    // Finer veins at different angle
    float fineNoise = snoise(warped * 5.0 + vec2(3.1, 7.4)) * 3.0;
    float fineVeins = sin(p.y * 12.0 + p.x * 4.0 + fineNoise);
    fineVeins = abs(fineVeins);
    fineVeins = smoothstep(0.0, 0.3, fineVeins);

    // Combine vein layers
    float allVeins = veins * 0.7 + fineVeins * 0.3;

    // === MARBLE COLORS ===
    vec3 baseColor = vec3(0.95, 0.93, 0.90);     // Warm white marble
    vec3 veinColor = vec3(0.3, 0.28, 0.25);      // Dark gray veins
    vec3 accentColor = vec3(0.6, 0.55, 0.45);    // Subtle gold/tan

    // Mix colors based on vein intensity
    vec3 color = mix(veinColor, baseColor, allVeins);

    // Add subtle color variation from warped domain
    float colorVar = snoise(warped * 2.0) * 0.5 + 0.5;
    color = mix(color, color + accentColor * 0.1, colorVar * 0.3);

    // === SUBTLE POLISH HIGHLIGHT ===
    // Slight brightness variation for polished look
    float polish = snoise(warped * 1.5) * 0.05 + 0.02;
    color += polish;

    gl_FragColor = vec4(color, 1.0);
}

// =============================================================================
// KEY PARAMETERS TO ADJUST:
//
// veinFrequency (8.0)     - Higher = more stripes, lower = fewer bold veins
// veinNoise multiplier (5.0) - Higher = more chaotic veins, lower = straighter
// warp strengths (0.5, 0.25) - Higher = more organic folds
// smoothstep range (0.0, 0.4) - Wider = softer veins, narrower = sharper
//
// VARIATIONS:
// - Black marble: swap baseColor/veinColor, add gold veins
// - Green marble: baseColor = vec3(0.2, 0.4, 0.3), veinColor = vec3(0.1, 0.2, 0.15)
// - Pink marble: baseColor = vec3(0.95, 0.85, 0.85), veinColor = vec3(0.6, 0.3, 0.35)
// =============================================================================
