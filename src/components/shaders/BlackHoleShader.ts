// BlackHoleShader.ts - Circumference glow effect for dark theme

export const blackHoleVertexShader = `
  varying vec2 vUv;
  varying vec2 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xy;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const blackHoleFragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIsLightTheme;
  uniform float uBlackHoleRadius;
  uniform float uAccretionRadius;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec2 vWorldPos;

  // === NOISE FUNCTIONS ===
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

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

  void main() {
    float x = vWorldPos.x;
    float y = vWorldPos.y;
    float dist = length(vWorldPos);
    float angle = atan(y, x);

    // === CIRCUMFERENCE RING ===
    float arcRadius = uBlackHoleRadius * 1.15;
    float ringThickness = uBlackHoleRadius * 0.25;
    float distFromArc = abs(dist - arcRadius);
    float lensedRing = exp(-distFromArc * distFromArc / (ringThickness * ringThickness * 2.0));

    // Brighter, more uniform glow
    lensedRing *= 2.5;
    lensedRing = clamp(lensedRing, 0.0, 1.0);

    // === SMOOTH RIVER FLOW ===
    float orbitSpeed = 0.4;
    float flowAngle = angle - uTime * orbitSpeed;
    // Single smooth gradient that rotates around
    float flow = 0.5 + 0.5 * cos(flowAngle);
    lensedRing *= 0.7 + flow * 0.5;

    // === GAS STREAKS (curved around the ring) ===
    float streakFlow = angle - uTime * 0.8;
    // Offset by distance to make streaks curve with the ring
    float curvedStreak = streakFlow + (dist - arcRadius) * 0.15;
    float streaks = 0.8 + 0.2 * sin(curvedStreak * 8.0);
    float fineStreaks = 0.9 + 0.1 * sin(curvedStreak * 20.0 + 0.5);
    streaks *= fineStreaks;
    lensedRing *= streaks;

    // === GLOW COLOR ===
    vec3 glowColor = vec3(1.0, 0.75, 0.35);
    glowColor *= 1.4;

    // === PLASMA UNIVERSE BACKGROUND (TileWave style) ===
    float tileSize = 4.0; // Tiny pixel-like tiles
    vec2 pixel = vWorldPos + uResolution * 0.5;
    vec2 tileCoord = floor(pixel / tileSize);
    vec2 tileCenter = (tileCoord + 0.5) * tileSize;
    vec2 inTile = fract(pixel / tileSize);

    // Normalized position for noise - smaller scale = bigger splotches
    vec2 normPos = tileCoord * 0.008;

    // Slow moving plasma - multiple noise layers
    float t = uTime * 0.15;
    float noise1 = snoise(normPos * 1.0 + t * 0.2) * 0.5;
    float noise2 = snoise(normPos * 1.8 - t * 0.15) * 0.35;
    float noise3 = snoise(normPos * 2.5 + t * 0.1) * 0.25;

    float plasma = noise1 + noise2 + noise3;
    plasma = plasma * 0.5 + 0.5; // Normalize to 0-1

    // Dark space colors - more variety (visible but still dark)
    vec3 deepBlue = vec3(0.06, 0.1, 0.28);
    vec3 darkPurple = vec3(0.18, 0.06, 0.3);
    vec3 cosmicTeal = vec3(0.05, 0.18, 0.22);
    vec3 nebulaRed = vec3(0.25, 0.08, 0.12);
    vec3 voidBlack = vec3(0.03, 0.03, 0.06);

    // Layer the colors with different noise patterns
    float colorNoise1 = snoise(normPos * 0.8 - t * 0.08) * 0.5 + 0.5;
    float colorNoise2 = snoise(normPos * 1.2 + t * 0.06) * 0.5 + 0.5;
    float colorNoise3 = snoise(normPos * 0.5 + vec2(t * 0.1, -t * 0.05)) * 0.5 + 0.5;

    vec3 bgColor = mix(deepBlue, darkPurple, plasma);
    bgColor = mix(bgColor, cosmicTeal, colorNoise1 * 0.6);
    bgColor = mix(bgColor, nebulaRed, colorNoise2 * 0.4);
    bgColor = mix(bgColor, voidBlack, colorNoise3 * 0.3);


    float bgIntensity = 0.8;

    // === COMPOSITE ===
    vec3 finalColor = mix(bgColor, glowColor, lensedRing);
    float finalAlpha = max(bgIntensity, lensedRing);

    // === EVENT HORIZON ===
    float inHorizon = 1.0 - smoothstep(uBlackHoleRadius * 0.98, uBlackHoleRadius * 1.0, dist);
    finalColor = mix(finalColor, vec3(0.0), inHorizon);
    finalAlpha = max(finalAlpha, inHorizon);

    // Edge fade
    float edgeFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    finalAlpha *= edgeFade * uOpacity;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export const BLACK_HOLE_DEFAULTS = {
  blackHoleRadius: 80.0,
  accretionRadius: 300.0,
};
