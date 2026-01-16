// Fibers Theme Fragment Shader
// Single tennis fiber with bending, kink, and full lighting

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;

// Fiber parameters (GUI controlled)
uniform float u_radius;
uniform float u_sharpness;
uniform float u_length;
uniform float u_texture;
uniform float u_angle;
uniform float u_curve;
uniform float u_bend;
uniform float u_kink;

// Lighting parameters (GUI controlled)
uniform float u_lightAngle;
uniform float u_lightHeight;
uniform float u_specular;
uniform float u_glossiness;

varying vec2 vUv;

// ============================================
// NOISE FUNCTIONS
// ============================================
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise1D(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f) * 2.0 - 1.0;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; i++) {
    v += a * hash2(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// ============================================
// DISTANCE: Point to infinite line
// ============================================
vec2 pointToLine(vec2 p, vec2 origin, vec2 dir) {
  vec2 w = p - origin;
  float t = dot(w, dir);
  vec2 closest = origin + t * dir;
  return vec2(length(p - closest), t);
}

// ============================================
// CURVED FIBER: Get point on bent fiber at parameter t
// ============================================
vec2 getCurvedFiberPoint(float t, float halfLen, vec2 fiberDir, vec2 fiberOrigin, float bend, float kink) {
  vec2 perpDir = vec2(-fiberDir.y, fiberDir.x);

  // Normalize t to [-1, 1]
  float tNorm = t / halfLen;

  // Arc bend: parabolic curve (max displacement at center)
  float arcOffset = bend * 0.1 * (1.0 - tNorm * tNorm);

  // Kink: random wobble using noise
  float kinkOffset = 0.0;
  if (kink > 0.0) {
    kinkOffset += noise1D(t * 8.0 + 123.0) * kink * 0.03;
    kinkOffset += noise1D(t * 20.0 + 456.0) * kink * 0.015;
    kinkOffset += noise1D(t * 45.0 + 789.0) * kink * 0.008;
  }

  float totalOffset = arcOffset + kinkOffset;

  return fiberOrigin + t * fiberDir + totalOffset * perpDir;
}

// ============================================
// FIND CLOSEST POINT ON CURVED FIBER
// ============================================
vec3 closestPointOnCurvedFiber(vec2 p, float halfLen, vec2 fiberDir, vec2 fiberOrigin, float bend, float kink) {
  vec2 w = p - fiberOrigin;
  float tGuess = dot(w, fiberDir);
  tGuess = clamp(tGuess, -halfLen, halfLen);

  float bestT = tGuess;
  float bestDist = 1000.0;

  // Coarse search
  for (float i = 0.0; i <= 1.0; i += 0.02) {
    float t = mix(-halfLen, halfLen, i);
    vec2 pt = getCurvedFiberPoint(t, halfLen, fiberDir, fiberOrigin, bend, kink);
    float d = length(p - pt);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }

  // Fine search around best
  float searchRadius = halfLen * 0.05;
  for (float i = 0.0; i <= 1.0; i += 0.1) {
    float t = bestT + mix(-searchRadius, searchRadius, i);
    t = clamp(t, -halfLen, halfLen);
    vec2 pt = getCurvedFiberPoint(t, halfLen, fiberDir, fiberOrigin, bend, kink);
    float d = length(p - pt);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }

  return vec3(bestDist, bestT, 0.0);
}

// ============================================
// FIBER PROFILE
// ============================================
float fiberProfile(float r, float radius, float sharpness) {
  float x = r / radius;
  float core = 1.0 - smoothstep(0.0, 1.0, pow(x, sharpness));
  float glow = exp(-x * x * 4.0) * 0.15;
  return core + glow;
}

// ============================================
// MAIN
// ============================================
void main() {
  vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  // Fiber direction from angle
  float rad = u_angle * 3.14159 / 180.0;
  vec2 fiberDir = normalize(vec2(cos(rad), sin(rad)));
  vec2 perpDir = vec2(-fiberDir.y, fiberDir.x);
  vec2 fiberOrigin = vec2(0.0, 0.0);

  float halfLen = u_length * 0.5;

  // Find closest point on curved fiber
  vec3 closest = closestPointOnCurvedFiber(uv, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);
  float dist = closest.x;
  float t = closest.y;

  // Get the actual point on curve
  vec2 curvePoint = getCurvedFiberPoint(t, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);

  // CAPSULE ENDPOINTS
  vec2 endpointA = getCurvedFiberPoint(-halfLen, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);
  vec2 endpointB = getCurvedFiberPoint(halfLen, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);

  float distToA = length(uv - endpointA);
  float distToB = length(uv - endpointB);

  bool atEndA = t <= -halfLen * 0.95 && distToA < dist;
  bool atEndB = t >= halfLen * 0.95 && distToB < dist;

  if (atEndA) {
    dist = distToA;
    curvePoint = endpointA;
    t = -halfLen;
  } else if (atEndB) {
    dist = distToB;
    curvePoint = endpointB;
    t = halfLen;
  }

  // Micro-curvature (fine detail on top of bend)
  float tNorm = t / halfLen;
  float curveOffset = noise1D(t * 15.0 + 42.0) * u_curve;
  curveOffset += noise1D(t * 35.0 + 17.0) * u_curve * 0.3;
  float curveMask = 1.0 - pow(abs(tNorm), 4.0);
  dist = abs(dist - curveOffset * curveMask);

  // Fiber profile
  float profile = fiberProfile(dist, u_radius, u_sharpness);

  // Surface texture
  float texCoordU = t * 200.0;
  float texCoordR = dist / u_radius * 50.0;
  float surfaceTex = fbm(vec2(texCoordU, texCoordR * 0.5));
  surfaceTex = mix(1.0, 0.7 + 0.3 * surfaceTex, u_texture * profile);

  // Combined density
  float density = profile * surfaceTex;

  // ============================================
  // COLOR + LIGHTING
  // ============================================
  vec3 fiberColor = vec3(0.95, 0.92, 0.85);
  fiberColor *= 0.95 + 0.05 * noise1D(t * 8.0);

  // === SURFACE NORMAL ===
  vec2 toSurface = uv - curvePoint;

  // Tangent of curve
  float dt = 0.001;
  vec2 curvePtNext = getCurvedFiberPoint(t + dt, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);
  vec2 curvePtPrev = getCurvedFiberPoint(t - dt, halfLen, fiberDir, fiberOrigin, u_bend, u_kink);
  vec2 tangent2D = normalize(curvePtNext - curvePtPrev);

  vec2 normal2D = normalize(toSurface);
  float radialDist = length(toSurface);
  float normalizedR = clamp(radialDist / u_radius, 0.0, 1.0);
  float nz = sqrt(1.0 - normalizedR * normalizedR);
  vec3 normal = normalize(vec3(normal2D * normalizedR, nz));

  // === LIGHT DIRECTION ===
  float lightRad = u_lightAngle * 3.14159 / 180.0;
  vec3 lightDir = normalize(vec3(
    cos(lightRad) * (1.0 - u_lightHeight),
    sin(lightRad) * (1.0 - u_lightHeight),
    u_lightHeight
  ));

  // === DIFFUSE ===
  float NdotL = max(dot(normal, lightDir), 0.0);
  float diffuse = NdotL;

  // === SPECULAR ===
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfVec), 0.0);
  float spec = pow(NdotH, u_glossiness) * u_specular;

  // === ANISOTROPIC HIGHLIGHT ===
  vec3 tangent = vec3(tangent2D, 0.0);
  float TdotH = dot(tangent, halfVec);
  float aniso = sqrt(1.0 - TdotH * TdotH);
  float anisoSpec = pow(aniso, u_glossiness * 0.5) * u_specular * 0.5;

  // === FRESNEL ===
  float fresnel = pow(1.0 - nz, 3.0) * 0.3;

  // === COMBINE LIGHTING ===
  float ambient = 0.25;
  vec3 litColor = fiberColor * (ambient + diffuse * 0.7);
  litColor += vec3(1.0) * (spec + anisoSpec);
  litColor += fiberColor * fresnel;

  // === SUBSURFACE ===
  float wrap = max(dot(normal, lightDir) + 0.3, 0.0) / 1.3;
  vec3 subsurface = fiberColor * vec3(1.0, 0.95, 0.9) * wrap * 0.15;
  litColor += subsurface * profile;

  // Background
  vec3 bgColor = vec3(0.08, 0.08, 0.1);

  // Final composite
  vec3 color = mix(bgColor, litColor, density);

  // Vignette
  float vignette = 1.0 - length(vUv - 0.5) * 0.5;
  color *= vignette;

  gl_FragColor = vec4(color, u_opacity);
}
`;
