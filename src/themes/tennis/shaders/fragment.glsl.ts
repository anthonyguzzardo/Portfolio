// Tennis Theme Fragment Shader
// Hyper-realistic tennis ball with volumetric felt via shell rendering
// Implements: Shell sampling, Oren-Nayar diffuse, Kajiya-Kay anisotropic,
// Charlie sheen, micro-shadowing, proper seam geometry

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
uniform vec2 u_rotation;
varying vec2 vUv;

// ============================================
// CONSTANTS
// ============================================
#define PI 3.14159265359
#define TAU 6.28318530718
#define MAX_STEPS 80
#define MAX_DIST 50.0
#define EPSILON 0.0005
#define SHELL_COUNT 12
#define BALL_RADIUS 0.65

// Physical measurements (normalized to ball radius)
// Real felt pile: 0.8-1.2mm on ~33mm radius ball
#define FELT_HEIGHT 0.03           // ~1mm felt pile
#define SEAM_DEPRESSION 0.012      // ~0.4mm trough depth
#define SEAM_WIDTH 0.08            // Seam tape width
#define SEAM_CURVE_RADIUS 0.25     // Smooth curve, not sharp

// ============================================
// ROTATION MATRICES
// ============================================
mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

mat3 rotateX(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

// ============================================
// NOISE FUNCTIONS
// ============================================
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Simplex-like gradient noise
vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
            dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
            dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
            dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
            dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
    u.z) * 0.5 + 0.5;
}

// FBM for fiber density
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise3D(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ============================================
// SEAM CURVE - TRUE TENNIS BALL GEOMETRY
// ============================================
// The tennis ball seam is a spherical curve defined by
// varying phi and theta in spherical coordinates.
// A ≈ 0.44 rad gives the characteristic shape.

vec3 seamPoint(float t) {
  float A = 0.44; // Seam amplitude (radians)

  // Spherical coordinate parameterization
  float phi = PI / 2.0 - (PI / 2.0 - A) * cos(t);
  float theta = t / 2.0 + A * sin(2.0 * t);

  // Convert to Cartesian (on unit sphere)
  return vec3(
    sin(phi) * cos(theta),
    sin(phi) * sin(theta),
    cos(phi)
  );
}

// Distance from point to line segment
float distToSegment(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a;
  vec3 ap = p - a;
  float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
  vec3 closest = a + t * ab;
  return length(p - closest);
}

// Distance to seam curve (continuous line, not discrete points)
float seamDistance(vec3 p) {
  float minDist = 1000.0;
  // Tennis ball seam completes in 4π (two loops around sphere)
  // Check distance to line segments between sample points
  vec3 prevPoint = seamPoint(0.0);

  for (int i = 1; i <= 80; i++) {
    float t = float(i) * 4.0 * PI / 80.0;
    vec3 currPoint = seamPoint(t);
    minDist = min(minDist, distToSegment(p, prevPoint, currPoint));
    prevPoint = currPoint;
  }
  return minDist;
}

// Seam tangent for fiber alignment (finds closest segment)
vec3 seamTangent(vec3 p) {
  float minDist = 1000.0;
  vec3 closestTangent = vec3(1.0, 0.0, 0.0);

  vec3 prevPoint = seamPoint(0.0);

  for (int i = 1; i <= 48; i++) {
    float t = float(i) * 4.0 * PI / 48.0;
    vec3 currPoint = seamPoint(t);

    float dist = distToSegment(p, prevPoint, currPoint);
    if (dist < minDist) {
      minDist = dist;
      closestTangent = normalize(currPoint - prevPoint);
    }
    prevPoint = currPoint;
  }
  return closestTangent;
}

// ============================================
// SEAM PROFILE - Physical trough shape
// ============================================
// Returns: x = depth factor (0=full felt, 1=seam center)
//          y = fiber height multiplier
//          z = fiber density multiplier
vec3 getSeamProfile(float seamDist) {
  // Smooth trough profile (not sharp V-shape)
  // Using smooth curve with radius ~8-15mm equivalent
  float seamEdge = SEAM_WIDTH * 0.5;

  // Normalized distance within seam (0 at edge, 1 at center)
  float inSeam = 1.0 - smoothstep(0.0, seamEdge, seamDist);

  // Trough depth profile - smooth parabolic, deepest at center
  // Cross section: ██████▇▆▅▃▂▁▁▂▃▅▆▇██████
  float depthProfile = inSeam * inSeam; // Quadratic = smooth curve

  // Fiber height reduction in seam (shorter, more compressed felt)
  // Felt pile goes from 1.0 (normal) to ~0.5 (seam center)
  float heightMult = 1.0 - depthProfile * 0.5;

  // Fiber density reduction near seam (disrupted, matted fibers)
  // More reduction at seam edges where tape meets felt
  float edgeTransition = smoothstep(0.0, seamEdge * 0.3, seamDist) *
                         (1.0 - smoothstep(seamEdge * 0.7, seamEdge, seamDist));
  float densityMult = 1.0 - inSeam * 0.4 - edgeTransition * 0.2;

  return vec3(depthProfile, heightMult, densityMult);
}

// ============================================
// FIBER FIELD MODEL
// ============================================
// Tennis ball felt is a volumetric micro-fiber field:
// - ~10^4 fibers/mm², 0.5-1.2mm length, 12-20 micron diameter
// - Semi-stiff, slightly crimped, free tips
// - Directional flow across surface (not random)
// - Realism comes from directional fiber OCCLUSION

// Coherent orientation field - fibers flow, not random
vec2 getOrientationField(vec3 p) {
  // Large-scale flow direction (manufacturing brush direction)
  float flowAngle = noise3D(p * 3.0) * TAU;

  // Medium-scale clustering
  float clusterAngle = noise3D(p * 15.0) * 0.8;

  // Local variance (individual fiber lean)
  float localVar = noise3D(p * 80.0) * 0.3;

  float angle = flowAngle + clusterAngle + localVar;
  return vec2(cos(angle), sin(angle));
}

// Fiber density with clustering (not uniform noise)
float getFiberDensity(vec3 p, float seamDist, float densityMult) {
  // Clustered distribution - fibers grow in clumps
  float clusters = noise3D(p * 45.0);
  clusters = clusters * clusters; // Sharpen clusters

  // Micro-scale individual fiber presence
  float microDensity = noise3D(p * 180.0);

  // Combine: cluster membership * individual presence
  float density = clusters * 0.6 + microDensity * 0.4;

  // Apply seam profile density reduction
  density *= densityMult;

  // Near seam: fibers compressed/bent, some gaps
  float nearSeam = 1.0 - smoothstep(0.0, SEAM_WIDTH, seamDist);
  density *= 1.0 - nearSeam * 0.3;

  return clamp(density, 0.0, 1.0);
}

// Fiber direction follows orientation field
vec3 getFiberDirection(vec3 p, vec3 normal, float seamDist) {
  // Get coherent orientation from field
  vec2 fieldDir = getOrientationField(p);

  // Build tangent frame on sphere
  vec3 up = abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, normal));
  vec3 bitangent = cross(normal, tangent);

  // Fiber direction from orientation field
  vec3 fiberDir = normalize(tangent * fieldDir.x + bitangent * fieldDir.y);

  // Near seam: fibers bend AWAY from seam (compressed)
  float seamInfluence = 1.0 - smoothstep(0.0, SEAM_WIDTH * 1.5, seamDist);
  if (seamInfluence > 0.01) {
    vec3 sTangent = seamTangent(p);
    sTangent = normalize(sTangent - normal * dot(sTangent, normal));
    // Perpendicular to seam = away from seam
    vec3 awayFromSeam = cross(normal, sTangent);
    fiberDir = normalize(mix(fiberDir, awayFromSeam, seamInfluence * 0.6));
  }

  return fiberDir;
}

// Fiber crimp - slight waviness along fiber length
vec3 applyFiberCrimp(vec3 fiberDir, vec3 p, float shellIndex) {
  // Crimp varies along fiber length
  float crimpPhase = noise3D(p * 100.0 + vec3(shellIndex * 5.0)) * TAU;
  float crimpAmount = 0.15 * (1.0 - shellIndex * 0.5); // Less crimp at tips

  // Perpendicular deviation
  vec3 perpDir = normalize(cross(fiberDir, vec3(0.0, 1.0, 0.0)));
  if (length(perpDir) < 0.1) perpDir = normalize(cross(fiberDir, vec3(1.0, 0.0, 0.0)));

  return normalize(fiberDir + perpDir * sin(crimpPhase) * crimpAmount);
}

// ============================================
// BRDF FUNCTIONS
// ============================================

// Oren-Nayar diffuse for rough surfaces
float orenNayarDiffuse(vec3 L, vec3 V, vec3 N, float roughness) {
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);

  float sigma2 = roughness * roughness;
  float A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
  float B = 0.45 * sigma2 / (sigma2 + 0.09);

  float thetaL = acos(NdotL);
  float thetaV = acos(NdotV);
  float alpha = max(thetaL, thetaV);
  float beta = min(thetaL, thetaV);

  vec3 Lproj = normalize(L - N * NdotL);
  vec3 Vproj = normalize(V - N * NdotV);
  float gamma = max(0.0, dot(Lproj, Vproj));

  return NdotL * (A + B * gamma * sin(alpha) * tan(beta));
}

// Kajiya-Kay anisotropic specular for fibers
float kajiyaKaySpecular(vec3 L, vec3 V, vec3 T, float power) {
  float TdotL = dot(T, L);
  float TdotV = dot(T, V);
  float sinTL = sqrt(max(0.0, 1.0 - TdotL * TdotL));
  float sinTV = sqrt(max(0.0, 1.0 - TdotV * TdotV));
  float spec = sinTL * sinTV - TdotL * TdotV;
  return pow(max(spec, 0.0), power);
}

// Charlie sheen distribution for velvet/cloth
float charlieD(float roughness, float NdotH) {
  float invR = 1.0 / roughness;
  float cos2h = NdotH * NdotH;
  float sin2h = max(0.0, 1.0 - cos2h);
  return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

float ashikhminV(float NdotV, float NdotL) {
  return 1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV + 0.001));
}

vec3 sheenBRDF(vec3 L, vec3 V, vec3 N, float roughness, vec3 sheenColor) {
  vec3 H = normalize(L + V);
  float NdotH = max(dot(N, H), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  float D = charlieD(roughness, NdotH);
  float Vis = ashikhminV(NdotV, NdotL);
  return sheenColor * D * Vis * NdotL;
}

// ============================================
// VOLUMETRIC FIBER OCCLUSION
// ============================================
// Realism comes from directional fiber occlusion, not color/noise

// Directional occlusion based on fiber orientation vs light
float fiberOcclusion(vec3 L, vec3 fiberDir, float density, float shellIndex) {
  // Fibers block light coming perpendicular to their direction
  float LdotT = abs(dot(L, fiberDir));
  float blockage = 1.0 - LdotT; // Max blockage when L perpendicular to fiber

  // Deeper = more occlusion from fibers above
  float depthFactor = 1.0 - shellIndex;

  // Dense areas block more
  float occlusion = blockage * density * depthFactor * 2.5;

  return exp(-occlusion);
}

// Self-shadowing within fiber volume
float volumetricShadow(float density, float shellIndex, float NdotL) {
  // Light has to penetrate through fiber volume
  float penetrationDepth = (1.0 - shellIndex);

  // Shadowing increases with density and depth
  float shadow = exp(-density * penetrationDepth * 3.0);

  // Grazing light gets blocked more
  shadow *= mix(0.2, 1.0, NdotL);

  return shadow;
}

// ============================================
// TIP SPARKLE - Specular only from fiber tips
// ============================================
float tipSparkle(vec3 L, vec3 V, vec3 T, float shellIndex, vec3 p) {
  // Only tips sparkle - specular collapses at roots
  float tipFactor = shellIndex * shellIndex * shellIndex; // Cubic = tips only

  // Broken, speckled sparkle (individual fiber tips catching light)
  float sparkleNoise = noise3D(p * 300.0);
  sparkleNoise = step(0.7, sparkleNoise); // Discrete sparkle points

  // Kajiya-Kay for anisotropic highlight direction
  float spec = kajiyaKaySpecular(L, V, T, 60.0); // Sharper power for tips

  return spec * tipFactor * sparkleNoise;
}

// Combined felt BRDF with proper fiber physics
vec3 feltBRDF(vec3 L, vec3 V, vec3 N, vec3 T, float roughness,
              float density, float shellIndex, vec3 albedo, vec3 sheenColor, vec3 p) {
  float NdotL = max(dot(N, L), 0.0);

  // Oren-Nayar diffuse (rough surface)
  float diffuse = orenNayarDiffuse(L, V, N, roughness);

  // Volumetric occlusion - the key to realism
  float dirOcclusion = fiberOcclusion(L, T, density, shellIndex);
  float volShadow = volumetricShadow(density, shellIndex, NdotL);

  // Tip sparkle - broken, anisotropic, tips only
  float sparkle = tipSparkle(L, V, T, shellIndex, p);

  // Sheen at grazing angles (fiber edges catching light)
  vec3 sheen = sheenBRDF(L, V, N, roughness, sheenColor);
  // Sheen also only at tips
  sheen *= shellIndex;

  // Color stratification: darker at base, brighter at tips
  float depthColor = mix(0.5, 1.0, shellIndex);
  vec3 stratifiedAlbedo = albedo * depthColor;

  // Combine with proper occlusion
  vec3 result = stratifiedAlbedo * diffuse * dirOcclusion * volShadow;
  result += sparkle * 0.2 * albedo;  // Tip sparkle tinted by felt color
  result += sheen * 0.15;

  return result;
}

// ============================================
// RAY MARCHING
// ============================================
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sceneSDF(vec3 p) {
  return sdSphere(p, BALL_RADIUS);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(EPSILON, 0.0);
  return normalize(vec3(
    sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
    sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
    sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
  ));
}

float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < EPSILON) return t;
    t += d * 0.8; // Slightly conservative stepping
    if (t > MAX_DIST) break;
  }
  return -1.0;
}

// ============================================
// MAIN RENDERING
// ============================================
void main() {
  vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  // Camera setup
  vec3 ro = vec3(0.0, 0.0, 2.5);
  vec3 rd = normalize(vec3(uv, -1.2));

  // Apply rotation to ray direction
  mat3 rot = rotateX(-u_rotation.y) * rotateY(-u_rotation.x);
  rd = rot * rd;
  ro = rot * ro;

  // Ray march to find surface
  float t = rayMarch(ro, rd);

  // Background - dark gradient
  vec3 color = mix(vec3(0.02, 0.02, 0.03), vec3(0.0), length(uv) * 0.5);

  if (t > 0.0) {
    vec3 hitPos = ro + rd * t;
    vec3 normal = calcNormal(hitPos);
    vec3 V = -rd;

    // Surface point normalized to unit sphere for texture coords
    vec3 surfacePoint = normalize(hitPos);

    // Seam calculations - get physical profile
    float seamDist = seamDistance(surfacePoint);
    vec3 seamProfile = getSeamProfile(seamDist);
    float seamDepth = seamProfile.x;      // 0-1, 1 = seam center
    float fiberHeightMult = seamProfile.y; // Shorter fibers in seam
    float fiberDensityMult = seamProfile.z; // Sparser fibers in seam

    // Perturb normal for seam trough (depression toward center)
    // Get direction toward seam centerline
    vec3 towardSeam = seamTangent(surfacePoint);
    towardSeam = cross(normal, towardSeam); // Perpendicular to seam, in surface
    towardSeam = normalize(towardSeam - normal * dot(towardSeam, normal));

    // Trough normal perturbation - slopes down toward seam center
    float troughSlope = seamDepth * (1.0 - seamDepth) * 4.0; // Max at edges
    vec3 troughNormal = normalize(normal - towardSeam * troughSlope * 0.15);

    // Colors in LINEAR space
    vec3 feltAlbedo = vec3(0.604, 0.787, 0.035); // Tennis ball yellow
    vec3 seamAlbedo = vec3(0.75, 0.73, 0.68);    // White/off-white seam tape
    vec3 sheenColor = vec3(1.0, 1.0, 0.85);

    // Specular collapse in seam - less fiber tip sparkle
    float sheenStrength = mix(1.0, 0.3, seamDepth);

    // Lighting setup (multiple lights)
    vec3 keyLight = normalize(vec3(1.5, 2.0, 1.0));
    vec3 fillLight = normalize(vec3(-1.0, 0.5, 0.8));
    vec3 rimLight = normalize(vec3(0.0, -0.5, 1.2));

    vec3 keyColor = vec3(1.0, 0.98, 0.95) * 1.2;
    vec3 fillColor = vec3(0.6, 0.65, 0.8) * 0.4;
    vec3 rimColor = vec3(1.0, 0.95, 0.9) * 0.6;

    // Shell rendering - accumulate color from multiple layers
    vec3 accumulatedColor = vec3(0.0);
    float accumulatedAlpha = 0.0;

    // Effective shell height varies with seam (shorter fibers in seam)
    float effectiveFeltHeight = FELT_HEIGHT * fiberHeightMult;

    for (int shell = 0; shell < SHELL_COUNT; shell++) {
      float shellIndex = float(shell) / float(SHELL_COUNT - 1);

      // Shell position - offset along normal, scaled by fiber height
      float shellOffset = shellIndex * effectiveFeltHeight;
      vec3 shellPos = hitPos + normal * shellOffset; // Outward from surface
      vec3 shellSurfacePoint = normalize(shellPos);

      // Fiber density with view-dependent boost and seam reduction
      float NdotV = max(dot(troughNormal, V), 0.0);
      float viewBoost = mix(1.15, 1.0, NdotV);
      float density = getFiberDensity(shellSurfacePoint, seamDist, fiberDensityMult) * viewBoost;

      // Alpha threshold - quadratic falloff
      float threshold = mix(0.08, 0.92, shellIndex * shellIndex);
      if (density < threshold) continue;

      // Fiber alpha
      float fiberAlpha = smoothstep(threshold - 0.1, threshold + 0.1, density);
      fiberAlpha *= (1.0 - shellIndex * 0.3); // Fade tips

      // Fiber direction from orientation field
      vec3 fiberDir = getFiberDirection(shellSurfacePoint, troughNormal, seamDist);

      // Apply fiber crimp (slight waviness)
      fiberDir = applyFiberCrimp(fiberDir, shellSurfacePoint, shellIndex);

      // Fibers lean outward slightly at tips
      float tipLean = shellIndex * 0.1;
      fiberDir = normalize(fiberDir + troughNormal * tipLean);

      // Perturbed normal for this shell - use trough normal as base
      vec3 microNoise = vec3(
        noise3D(shellSurfacePoint * 120.0) - 0.5,
        noise3D(shellSurfacePoint * 120.0 + vec3(50.0)) - 0.5,
        noise3D(shellSurfacePoint * 120.0 + vec3(100.0)) - 0.5
      ) * 0.15 * (1.0 - shellIndex);
      vec3 shellNormal = normalize(troughNormal + microNoise);

      // Base color - yellow felt or white seam tape
      // Depth stratification handled in feltBRDF
      vec3 shellAlbedo = mix(feltAlbedo, seamAlbedo, seamDepth);

      // Roughness varies - seam has lower variance (more uniform)
      float roughness = 0.75 + (1.0 - shellIndex) * 0.1;
      roughness = mix(roughness, 0.8, seamDepth); // More uniform in seam

      // Sheen color modulated by specular collapse in seam
      vec3 shellSheen = sheenColor * sheenStrength;

      // Accumulate lighting from all lights
      vec3 shellColor = vec3(0.0);

      // Key light
      shellColor += feltBRDF(keyLight, V, shellNormal, fiberDir, roughness,
                             density, shellIndex, shellAlbedo, shellSheen, shellSurfacePoint) * keyColor;

      // Fill light
      shellColor += feltBRDF(fillLight, V, shellNormal, fiberDir, roughness,
                             density, shellIndex, shellAlbedo, shellSheen, shellSurfacePoint) * fillColor;

      // Rim light (emphasize edge fibers) - reduced in seam
      vec3 rimContrib = feltBRDF(rimLight, V, shellNormal, fiberDir, roughness,
                                 density, shellIndex, shellAlbedo, shellSheen, shellSurfacePoint) * rimColor;
      rimContrib *= smoothstep(0.3, 0.0, NdotV) * (1.0 - seamDepth * 0.5);
      shellColor += rimContrib;

      // Ambient occlusion - enhanced in seam trough (micro self-shadowing)
      float ao = mix(0.4, 1.0, shellIndex);
      // Seam trough catches less light - self-shadowing from edges
      float seamShadow = 1.0 - seamDepth * 0.25;
      // Extra darkening at seam edges where fibers cast shadows into trough
      float edgeShadow = seamDepth * (1.0 - seamDepth) * 0.3;
      ao *= seamShadow * (1.0 - edgeShadow);
      shellColor *= ao;

      // Ambient fill
      shellColor += shellAlbedo * 0.06;

      // Front-to-back alpha compositing
      float alpha = fiberAlpha * (1.0 - accumulatedAlpha);
      accumulatedColor += shellColor * alpha;
      accumulatedAlpha += alpha;

      // Early exit if fully opaque
      if (accumulatedAlpha > 0.98) break;
    }

    // Add base layer for remaining transparency (rubber core showing through)
    if (accumulatedAlpha < 1.0) {
      vec3 baseAlbedo = mix(feltAlbedo, seamAlbedo, seamDepth) * 0.5;
      float baseDiffuse = orenNayarDiffuse(keyLight, V, troughNormal, 0.85);
      vec3 baseColor = baseAlbedo * baseDiffuse * keyColor * 0.4;
      // Extra darkening in seam trough
      baseColor *= (1.0 - seamDepth * 0.3);
      baseColor += baseAlbedo * 0.04;
      accumulatedColor += baseColor * (1.0 - accumulatedAlpha);
    }

    color = accumulatedColor;

    // Subtle subsurface scattering approximation
    float sss = pow(max(dot(V, -keyLight), 0.0), 3.0) * 0.06;
    color += feltAlbedo * sss;

    // Gamma correction (linear -> sRGB)
    color = pow(color, vec3(1.0 / 2.2));

    // Slight vignette on the ball itself for depth
    float ballVignette = 1.0 - smoothstep(0.4, 0.7, length(hitPos.xy)) * 0.1;
    color *= ballVignette;
  }

  gl_FragColor = vec4(color, u_opacity);
}
`;
