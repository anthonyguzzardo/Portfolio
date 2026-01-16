// =============================================================================
// SMOKE / CLOUDS
// Rising smoke effect using domain warping + FBM + upward drift
//
// Technique: Warp coordinates with upward bias, sample FBM for density
// Result: Billowing, rising smoke that dissipates at the top
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
// FBM - Fractal Brownian Motion
// Layered noise for cloud-like density
// -----------------------------------------------------------------------------

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // 5 octaves for detailed smoke
    for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    return value;
}

// -----------------------------------------------------------------------------
// SMOKE WARP
// Domain warp with upward drift bias
// -----------------------------------------------------------------------------

vec2 smokeWarp(vec2 p, float t) {
    // === UPWARD DRIFT ===
    // This is key for smoke - constant upward motion
    float upwardSpeed = 0.3;
    vec2 drift = vec2(0.0, t * upwardSpeed);

    // Turbulent horizontal drift (slower than vertical)
    vec2 turbulence = vec2(
        sin(t * 0.11) * 0.15 + cos(t * 0.07) * 0.1,
        sin(t * 0.13) * 0.05
    );

    // Layer 1: Large billows
    vec2 p1 = p * 1.0 + drift + turbulence;
    vec2 w1 = vec2(
        snoise(p1),
        snoise(p1 + vec2(5.2, 1.3))
    ) * 0.4;

    // Layer 2: Medium swirls - moves faster
    vec2 p2 = p * 2.0 + drift * 1.3 + w1;
    vec2 w2 = vec2(
        snoise(p2 + vec2(1.7, 9.2)),
        snoise(p2 + vec2(8.3, 2.8))
    ) * 0.2;

    // Layer 3: Fine wisps - moves fastest
    vec2 p3 = p * 4.0 + drift * 1.6 + w1 + w2;
    vec2 w3 = vec2(
        snoise(p3 + vec2(4.1, 3.7)),
        snoise(p3 + vec2(2.9, 7.1))
    ) * 0.1;

    return p + w1 + w2 + w3;
}

void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;

    float t = uTime;

    // === DOMAIN WARP ===
    vec2 warped = smokeWarp(p, t);

    // === SMOKE DENSITY ===
    // FBM gives the billowing cloud structure
    float density = fbm(warped * 2.0);

    // Remap from [-1,1] to [0,1] range
    density = density * 0.5 + 0.5;

    // === VERTICAL FALLOFF ===
    // Smoke dissipates at top, dense at bottom (source)
    float verticalFade = smoothstep(1.0, -0.5, p.y);

    // Smoke source at bottom center
    float sourceDistance = length(vec2(p.x, p.y + 0.8));
    float sourceMask = smoothstep(1.2, 0.0, sourceDistance);

    // Combine density with falloffs
    float smoke = density * verticalFade * sourceMask;

    // === WISPY EDGES ===
    // Use higher frequency noise to break up edges
    float wisps = snoise(warped * 6.0 + vec2(t * 0.2, 0.0));
    smoke *= smoothstep(-0.3, 0.3, wisps + smoke * 0.5);

    // === SMOKE COLOR ===
    vec3 backgroundColor = vec3(0.02, 0.02, 0.03);  // Near black
    vec3 smokeColor = vec3(0.6, 0.6, 0.65);          // Gray smoke

    // Slight color variation - hotter (brighter) near source
    float heat = smoothstep(0.5, -0.5, p.y) * sourceMask;
    smokeColor = mix(smokeColor, vec3(0.8, 0.75, 0.7), heat * 0.3);

    // Final color
    vec3 color = mix(backgroundColor, smokeColor, smoke);

    // === OPTIONAL: Subtle internal glow ===
    float glow = smoke * smoke * heat;
    color += vec3(1.0, 0.6, 0.2) * glow * 0.15;

    gl_FragColor = vec4(color, 1.0);
}

// =============================================================================
// KEY PARAMETERS TO ADJUST:
//
// upwardSpeed (0.3)       - Faster = smoke rises quicker
// warp strengths          - Higher = more turbulent billows
// fbm octaves (5)         - More = finer detail, fewer = softer
// verticalFade range      - Controls how quickly smoke dissipates
// sourceMask radius (1.2) - Size of smoke source area
//
// VARIATIONS:
// - Fog: Remove upward drift, use horizontal drift, no source mask
// - Steam: Faster rise, quicker dissipation, whiter color
// - Campfire smoke: Add slight orange glow, narrower source
// - Clouds: No vertical fade, no source, just FBM + slow drift
// =============================================================================
