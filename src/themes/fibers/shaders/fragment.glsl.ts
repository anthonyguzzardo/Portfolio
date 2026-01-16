// Fibers Theme Fragment Shader
// Hair/fur/felt - fibers rooted at one end, extending outward

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;

// Fiber parameters (GUI controlled)
uniform float u_scale;
uniform float u_radius;
uniform float u_sharpness;
uniform float u_length;
uniform float u_texture;
uniform float u_angle;      // Base direction (degrees)
uniform float u_curve;
uniform float u_bend;       // How much fibers bend
uniform float u_kink;       // Angle randomness (spread)

// Lighting parameters (GUI controlled)
uniform float u_lightAngle;
uniform float u_lightHeight;
uniform float u_specular;
uniform float u_glossiness;

varying vec2 vUv;

#define PI 3.14159265359

// ============================================
// HASH FUNCTIONS
// ============================================
float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float noise1D(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f) * 2.0 - 1.0;
}

// ============================================
// FIBER SDF - rooted at origin, extending in direction
// Returns: x = distance to fiber, y = t along fiber (0=root, 1=tip)
// ============================================
vec2 fiberSDF(vec2 p, vec2 root, vec2 dir, float len, float bend, float seed) {
  vec2 perpDir = vec2(-dir.y, dir.x);
  vec2 toP = p - root;

  // Project onto fiber direction
  float t = dot(toP, dir);
  t = clamp(t, 0.0, len); // 0 at root, len at tip

  // Normalized position along fiber
  float tNorm = t / len;

  // Bend: parabolic curve, max at tip
  float bendOffset = bend * len * tNorm * tNorm;

  // Small wobble
  float wobble = noise1D(tNorm * 4.0 + seed) * len * 0.02;

  // Point on fiber
  vec2 fiberPt = root + t * dir + (bendOffset + wobble) * perpDir;

  return vec2(length(p - fiberPt), tNorm);
}

// ============================================
// FIBER PROFILE - softer at tip
// ============================================
float fiberProfile(float dist, float radius, float sharpness, float tNorm) {
  // Taper toward tip
  float taperRadius = radius * (1.0 - tNorm * 0.3);
  float x = dist / taperRadius;
  float core = 1.0 - smoothstep(0.0, 1.0, pow(x, sharpness));
  return core;
}

// ============================================
// RENDER SINGLE FIBER
// ============================================
vec4 renderFiber(vec2 uv, vec2 root, vec2 dir, float len, float radius,
                 float sharpness, float bend, float seed, vec3 baseColor, vec3 lightDir) {

  vec2 sdf = fiberSDF(uv, root, dir, len, bend, seed);
  float dist = sdf.x;
  float tNorm = sdf.y;

  // Early out
  if (dist > radius * 1.5) return vec4(0.0);

  float profile = fiberProfile(dist, radius, sharpness, tNorm);
  if (profile < 0.01) return vec4(0.0);

  // Normal calculation
  vec2 perpDir = vec2(-dir.y, dir.x);
  float bendOffset = bend * len * tNorm * tNorm;
  float wobble = noise1D(tNorm * 4.0 + seed) * len * 0.02;
  vec2 fiberPt = root + tNorm * len * dir + (bendOffset + wobble) * perpDir;
  vec2 toSurface = uv - fiberPt;

  float taperRadius = radius * (1.0 - tNorm * 0.3);
  vec2 normal2D = length(toSurface) > 0.0001 ? normalize(toSurface) : perpDir;
  float normalizedR = clamp(dist / taperRadius, 0.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - normalizedR * normalizedR));
  vec3 normal = normalize(vec3(normal2D * normalizedR, nz));

  // Lighting
  float NdotL = max(dot(normal, lightDir), 0.0);

  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfVec), 0.0);
  float spec = pow(NdotH, u_glossiness) * u_specular;

  // Anisotropic highlight along fiber
  vec3 tangent = vec3(dir, 0.0);
  float TdotH = dot(tangent, halfVec);
  float aniso = sqrt(max(0.0, 1.0 - TdotH * TdotH));
  float anisoSpec = pow(aniso, u_glossiness * 0.5) * u_specular * 0.4;

  // Fresnel
  float fresnel = pow(1.0 - nz, 3.0) * 0.15;

  // Combine lighting
  float ambient = 0.25;
  vec3 color = baseColor * (ambient + NdotL * 0.6);
  color += vec3(1.0) * (spec + anisoSpec);
  color += baseColor * fresnel;

  // Slight darkening at root (embedded in surface)
  color *= 0.85 + 0.15 * tNorm;

  return vec4(color, profile);
}

// ============================================
// MAIN
// ============================================
void main() {
  vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  // Parameters
  float scale = u_scale;
  float radius = u_radius * scale;
  float len = u_length * scale;
  float cellSize = len * 0.4; // Density of fiber roots
  float bend = u_bend;
  float angleSpread = u_kink * 0.5; // Radians of random spread

  // Base direction
  float baseAngle = u_angle * PI / 180.0;
  vec2 baseDir = vec2(cos(baseAngle), sin(baseAngle));

  // Light
  float lightRad = u_lightAngle * PI / 180.0;
  vec3 lightDir = normalize(vec3(
    cos(lightRad) * (1.0 - u_lightHeight),
    sin(lightRad) * (1.0 - u_lightHeight),
    u_lightHeight
  ));

  // Fiber color
  vec3 fiberColor = vec3(0.95, 0.92, 0.85);

  // Background (the "scalp")
  vec3 bgColor = vec3(0.12, 0.10, 0.08);

  // Find current cell
  vec2 cellId = floor(uv / cellSize);

  vec3 finalColor = bgColor;
  float maxDensity = 0.0;

  // Check 5x5 neighborhood (fibers can extend into neighboring cells)
  for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
    for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
      vec2 neighborCell = cellId + vec2(dx, dy);
      vec2 randVal = hash2(neighborCell);

      // Root position: random within cell
      vec2 root = (neighborCell + randVal) * cellSize;

      // Random angle variation
      float angleVar = (randVal.x - 0.5) * 2.0 * angleSpread;
      float fiberAngle = baseAngle + angleVar;
      vec2 dir = vec2(cos(fiberAngle), sin(fiberAngle));

      // Random bend variation
      float fiberBend = bend * (0.5 + randVal.y);

      // Seed for this fiber's noise
      float seed = randVal.x * 100.0 + randVal.y * 37.0;

      // Slight length variation
      float fiberLen = len * (0.8 + randVal.y * 0.4);

      // Render fiber
      vec4 fiber = renderFiber(uv, root, dir, fiberLen, radius,
                                u_sharpness, fiberBend, seed, fiberColor, lightDir);

      if (fiber.a > 0.01) {
        // Simple depth: fibers further from camera (lower y of root) are behind
        float depthFactor = 1.0 - (neighborCell.y * 0.02 + randVal.y * 0.1);
        depthFactor = clamp(depthFactor, 0.7, 1.0);

        // Blend
        float blend = fiber.a * (1.0 - maxDensity * 0.3);
        finalColor = mix(finalColor, fiber.rgb * depthFactor, blend);
        maxDensity = max(maxDensity, fiber.a);
      }
    }
  }

  // Subtle vignette
  float vignette = 1.0 - length(vUv - 0.5) * 0.3;
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, u_opacity);
}
`;
