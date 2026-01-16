// =============================================================================
// ORGANIC / BIOLOGICAL
// Cellular, living tissue effect using domain warping + voronoi-like patterns
//
// Technique: Slow cascade warp + cellular noise creates living membrane look
// Result: Pulsing, breathing organic surface like cells or tissue
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
// SIMPLE VORONOI
// Creates cellular patterns - distance to nearest random point
// -----------------------------------------------------------------------------

vec2 hash2(vec2 p) {
    return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
}

// Returns vec2(distance to nearest point, distance to second nearest)
vec2 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    float d1 = 8.0;  // Nearest
    float d2 = 8.0;  // Second nearest

    // Check 3x3 neighborhood
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);

            // Animate cell centers slowly
            o = 0.5 + 0.4 * sin(uTime * 0.3 + 6.2831 * o);

            vec2 diff = g + o - f;
            float d = dot(diff, diff);

            if (d < d1) {
                d2 = d1;
                d1 = d;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }

    return vec2(sqrt(d1), sqrt(d2));
}

// -----------------------------------------------------------------------------
// ORGANIC WARP
// Slow, breathing domain warp for living tissue feel
// -----------------------------------------------------------------------------

vec2 organicWarp(vec2 p, float t) {
    // Very slow drift - organic things move slowly
    vec2 drift = vec2(
        sin(t * 0.07) * 0.2 + cos(t * 0.05) * 0.15,
        cos(t * 0.06) * 0.2 + sin(t * 0.04) * 0.15
    );

    // Layer 1: Large membrane folds
    vec2 p1 = p * 1.0 + drift;
    vec2 w1 = vec2(
        snoise(p1),
        snoise(p1 + vec2(5.2, 1.3))
    ) * 0.3;

    // Layer 2: Medium tissue compression
    vec2 p2 = p * 2.0 + w1 + drift * 0.6;
    vec2 w2 = vec2(
        snoise(p2 + vec2(1.7, 9.2)),
        snoise(p2 + vec2(8.3, 2.8))
    ) * 0.15;

    // Layer 3: Fine cellular detail
    vec2 p3 = p * 3.5 + w1 + w2 + drift * 0.4;
    vec2 w3 = vec2(
        snoise(p3 + vec2(4.1, 3.7)),
        snoise(p3 + vec2(2.9, 7.1))
    ) * 0.08;

    return p + w1 + w2 + w3;
}

void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= uResolution.x / uResolution.y;

    // Slow time for organic feel
    float t = uTime * 0.4;

    // === DOMAIN WARP ===
    vec2 warped = organicWarp(p, t);

    // === CELLULAR PATTERN ===
    // Voronoi at warped coordinates creates organic cells
    float cellScale = 5.0;
    vec2 vor = voronoi(warped * cellScale);
    float cellDist = vor.x;      // Distance to nearest cell center
    float cellEdge = vor.y - vor.x;  // Distance between cells (edge detection)

    // === CELL MEMBRANE ===
    // Dark edges where cells meet
    float membrane = smoothstep(0.0, 0.15, cellEdge);

    // === CELL INTERIOR ===
    // Gradient from edge to center within each cell
    float cellInterior = smoothstep(0.0, 0.5, cellDist);
    cellInterior = 1.0 - cellInterior;  // Invert: bright center, dark edge

    // === BREATHING PULSE ===
    // Cells pulse slightly, offset by position for organic wave
    float pulse = sin(t * 2.0 + warped.x * 3.0 + warped.y * 2.0) * 0.5 + 0.5;
    pulse = pulse * 0.15 + 0.85;

    // === SUBSURFACE GLOW ===
    // Warped noise creates internal structure visible through membrane
    float subsurface = snoise(warped * 3.0 + vec2(t * 0.1, 0.0)) * 0.5 + 0.5;
    subsurface += snoise(warped * 6.0 + vec2(0.0, t * 0.15)) * 0.25;

    // === ORGANIC COLORS ===
    // Tissue-like palette
    vec3 membraneColor = vec3(0.15, 0.08, 0.1);      // Dark membrane
    vec3 cellColor = vec3(0.7, 0.25, 0.3);           // Reddish cell
    vec3 nucleusColor = vec3(0.9, 0.4, 0.35);        // Bright nucleus
    vec3 subsurfaceColor = vec3(0.5, 0.15, 0.2);     // Deep red glow

    // === BUILD COLOR ===
    // Start with membrane
    vec3 color = membraneColor;

    // Add cell interior color
    color = mix(color, cellColor, membrane * cellInterior);

    // Bright nucleus at cell centers
    float nucleus = smoothstep(0.3, 0.0, cellDist) * membrane;
    color = mix(color, nucleusColor, nucleus * pulse);

    // Subsurface scattering glow
    color += subsurfaceColor * subsurface * membrane * 0.2;

    // === VEIN NETWORK ===
    // Optional: Add vein-like structures between cells
    float veins = snoise(warped * 8.0);
    veins = smoothstep(0.4, 0.5, abs(veins));
    veins *= (1.0 - membrane) * 0.5;  // Only visible at edges
    color += vec3(0.4, 0.1, 0.15) * veins;

    // === OVERALL PULSE ===
    // Subtle global brightness pulse
    float globalPulse = sin(t * 1.5) * 0.05 + 1.0;
    color *= globalPulse;

    gl_FragColor = vec4(color, 1.0);
}

// =============================================================================
// KEY PARAMETERS TO ADJUST:
//
// cellScale (5.0)         - Higher = smaller/more cells
// warp strengths (0.3, 0.15, 0.08) - Lower than paint for subtler movement
// time multiplier (0.4)   - Slow for organic feel
// voronoi animation speed (0.3) - Cell center movement speed
// pulse frequency (2.0)   - Breathing rate
//
// VARIATIONS:
// - Alien tissue: Use green/purple palette, higher warp strength
// - Microscope view: Add grain, chromatic aberration, brighter colors
// - Plant cells: Add chloroplast dots (green noise spots), rectangular bias
// - Neural network: Connect cell centers with lines, add firing pulses
// - Skin: Reduce voronoi visibility, add pores (small dark spots)
// =============================================================================
