# RESEARCH: Hyper-Realistic Tennis Ball Rendering (WebGL2 / Three.js)

## EXECUTIVE SUMMARY

This document is an **implementation-ready specification** for building a hyper-realistic tennis ball in WebGL2/Three.js. It provides complete technical details, working code patterns, mathematical formulas, and validation criteria.

---

## 1. CONSTRAINTS & TARGET

### Hard Constraints
- Platform: WebGL2 (no WebGPU)
- Engine: Three.js (latest stable)
- No geometry shaders (WebGL2 limitation)
- No offline ray tracing
- Must run at 60fps on consumer GPUs
- Must support dynamic rotation and lighting
- No baked lighting assumptions

### Target Visual Phenomena
1. Volumetric felt fuzz appearance
2. Fiber-driven anisotropic highlights
3. Micro-shadowing at fiber base
4. Velvet-style grazing angle highlights (sheen)
5. Seam geometry with fiber disruption
6. View-dependent appearance change
7. Soft color absorption in fiber depths

---

## 2. FUNDAMENTAL PRINCIPLE

A tennis ball surface is **NOT a surface**—it is a **volumetric fiber field**.

Any approach using:
- Only normal maps → **FAIL**
- Stock `MeshStandardMaterial` → **FAIL**
- Single shading layer → **FAIL**

The solution requires **multi-layer shell rendering** combined with a **custom felt BRDF**.

---

## 3. GEOMETRY SPECIFICATION

### 3.1 Base Sphere

```javascript
const BALL_RADIUS = 3.3; // cm (regulation: 6.54-6.86cm diameter)
const SEGMENTS = 128;    // High tessellation for smooth shells

const geometry = new THREE.SphereGeometry(BALL_RADIUS, SEGMENTS, SEGMENTS);
```

**UV Considerations**: Standard spherical UVs have polar distortion. For best results, use **octahedral UV mapping** or accept distortion at poles (less visible on tennis ball).

### 3.2 Seam Curve Geometry (CRITICAL)

The tennis ball seam is mathematically defined as a **spherical curve**. The most accurate parametric form:

**Parametric Equation (Spherical Curve):**

The tennis ball seam is a **spherical curve** defined by varying φ and θ in spherical coordinates:

```
φ(t) = π/2 - (π/2 - A) * cos(t)
θ(t) = t/2 + A * sin(2t)

x(t) = sin(φ) * cos(θ)
y(t) = sin(φ) * sin(θ)
z(t) = cos(φ)
```

Where for a tennis ball:
- `A ≈ 0.44` radians (~25°) - controls how far the seam dips toward poles
- `t` ranges from `0` to `4π` (two complete loops to close the curve)

This produces the characteristic figure-8 wrapped around the sphere that divides it into two congruent dumbbell-shaped pieces (the "tennis ball theorem").

**Alternative (Simpler):** Intersection of sphere with hyperbolic paraboloid:
```
Sphere: x² + y² + z² = r²
Hypar: z = k * x * y (where k controls curve tightness)
```

**Implementation Options:**

1. **Texture-based seam mask** (recommended for real-time):
   - Generate seam curve in UV space
   - Create binary mask + distance field
   - Sample in shader for fiber disruption

2. **Geometry-based seam** (higher quality):
   - Extrude tube geometry along seam curve
   - Boolean union with sphere
   - More expensive but physically accurate

**Seam Data Outputs Required:**
| Texture | Purpose | Format |
|---------|---------|--------|
| `seamMask` | Binary seam location | R8 |
| `seamDistance` | Distance from seam (for falloff) | R16F |
| `seamTangent` | Tangent direction along seam | RG16F |

---

## 4. SHELL RENDERING IMPLEMENTATION

Shell rendering creates volumetric fur/felt by rendering **N concentric copies** of the base geometry, each offset along surface normals.

### 4.1 Shell Parameters

```javascript
const SHELL_COUNT = 16;        // 8-24 typical, GPU dependent
const SHELL_HEIGHT = 0.15;     // Total fuzz height in scene units
const SHELL_STEP = SHELL_HEIGHT / SHELL_COUNT;
```

### 4.2 Three.js Implementation (InstancedMesh approach)

```javascript
// Create instanced mesh for all shells
const shellGeometry = geometry.clone();
const shellMaterial = new THREE.ShaderMaterial({ /* custom shader */ });

const shellMesh = new THREE.InstancedMesh(shellGeometry, shellMaterial, SHELL_COUNT);

// Set per-instance data via custom attribute
const shellIndices = new Float32Array(SHELL_COUNT);
for (let i = 0; i < SHELL_COUNT; i++) {
  shellIndices[i] = i / (SHELL_COUNT - 1); // Normalized 0-1
}

shellGeometry.setAttribute('shellIndex', 
  new THREE.InstancedBufferAttribute(shellIndices, 1)
);
```

### 4.3 Vertex Shader (Shell Offset)

```glsl
attribute float shellIndex;
attribute vec4 tangent; // Three.js computed tangent (xyz = tangent, w = handedness)

uniform float uShellHeight;
uniform sampler2D uFiberDensity;

varying float vShellIndex;
varying vec2 vUv;
varying mat3 vTBN; // Tangent-Bitangent-Normal matrix for fiber direction

void main() {
  vShellIndex = shellIndex;
  vUv = uv;

  // Build TBN matrix for transforming fiber directions to world space
  vec3 T = normalize(normalMatrix * tangent.xyz);
  vec3 N = normalize(normalMatrix * normal);
  vec3 B = normalize(cross(N, T) * tangent.w); // w = handedness
  vTBN = mat3(T, B, N);

  // Sample fiber density for this shell layer
  float density = texture2D(uFiberDensity, uv).r;

  // Offset along normal, scaled by shell index
  float offset = shellIndex * uShellHeight;
  vec3 shellPosition = position + normal * offset;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(shellPosition, 1.0);
}

// IMPORTANT: Call geometry.computeTangents() after creating SphereGeometry
// to generate the tangent attribute required for proper fiber direction
```

### 4.4 Fragment Shader (Alpha Discard)

```glsl
varying float vShellIndex;
varying vec2 vUv;
varying mat3 vTBN;

uniform sampler2D uFiberDensity;
uniform sampler2D uFiberDirection;
uniform float uFiberThreshold;

void main() {
  float density = texture2D(uFiberDensity, vUv).r;

  // View-dependent density: more fibers visible at grazing angles
  vec3 N = normalize(vTBN[2]); // Normal from TBN
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  float NdotV = max(dot(N, V), 0.0);
  float viewDensityBoost = mix(1.2, 1.0, NdotV); // More visible at edges
  density *= viewDensityBoost;

  // Probabilistic discard based on shell height
  // Higher shells have fewer fibers (tips)
  float threshold = mix(0.1, 0.9, vShellIndex);

  if (density < threshold) {
    discard;
  }

  // Get fiber tangent direction using TBN matrix
  vec2 fiberDir2D = texture2D(uFiberDirection, vUv).rg * 2.0 - 1.0;
  // Add slight variation with shell depth (fiber curvature)
  float curvature = 0.1 * vShellIndex;
  fiberDir2D = normalize(fiberDir2D + vec2(curvature, curvature * 0.5));
  vec3 fiberTangent = normalize(vTBN * vec3(fiberDir2D, 0.0));

  // Continue to lighting with fiberTangent...
}
```

---

## 5. TEXTURE GENERATION

### 5.1 Required Texture Set

| Texture | Purpose | Resolution | Format |
|---------|---------|------------|--------|
| `albedo` | Base felt color | 1024² | RGB8 |
| `fiberDensity` | Fiber presence probability | 512² | R8 |
| `fiberDirection` | Tangent-space fiber orientation | 512² | RG16F |
| `microNormal` | Fine fiber normal variation | 1024² | RGB8 |
| `seamMask` | Seam location | 512² | R8 |
| `aoDepth` | Fiber base occlusion | 512² | R8 |

### 5.2 Procedural Fiber Density (GLSL)

```glsl
// Fractal Brownian Motion noise for fiber density
float fbm(vec2 uv, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < octaves; i++) {
    value += amplitude * snoise(uv * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float generateFiberDensity(vec2 uv) {
  // Base density from noise
  float density = fbm(uv * 50.0, 5) * 0.5 + 0.5;
  
  // Modulate by seam proximity (fibers disrupted near seam)
  float seamDist = texture2D(uSeamDistance, uv).r;
  float seamFalloff = smoothstep(0.0, 0.05, seamDist);
  
  density *= seamFalloff;
  
  return density;
}
```

### 5.3 Fiber Direction Map

Fiber direction should flow **around** the seam, not across it:

```glsl
vec2 generateFiberDirection(vec2 uv) {
  // Base random direction from noise
  vec2 baseDir = vec2(
    snoise(uv * 30.0),
    snoise(uv * 30.0 + 100.0)
  );
  baseDir = normalize(baseDir);
  
  // Near seam: align with seam tangent
  float seamDist = texture2D(uSeamDistance, uv).r;
  vec2 seamTangent = texture2D(uSeamTangent, uv).rg * 2.0 - 1.0;
  
  float seamInfluence = 1.0 - smoothstep(0.0, 0.1, seamDist);
  
  return normalize(mix(baseDir, seamTangent, seamInfluence));
}
```

---

## 6. BRDF IMPLEMENTATION

### 6.1 Why Standard PBR Fails

Standard microfacet BRDFs (GGX, Cook-Torrance) assume:
- Smooth microfacets
- Single-scattering only
- Isotropic roughness

Felt/velvet requires:
- Volumetric fiber scattering
- Anisotropic highlights aligned to fiber direction
- Grazing angle sheen (inverse Fresnel behavior)

### 6.2 Complete Felt BRDF (GLSL)

```glsl
// ============================================
// FELT BRDF - Complete Implementation
// ============================================

// Oren-Nayar Diffuse (for rough surfaces)
float orenNayarDiffuse(vec3 L, vec3 V, vec3 N, float roughness) {
  float LdotN = max(dot(L, N), 0.0);
  float VdotN = max(dot(V, N), 0.0);
  
  float sigma2 = roughness * roughness;
  float A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
  float B = 0.45 * sigma2 / (sigma2 + 0.09);
  
  // Angle calculations
  float thetaL = acos(LdotN);
  float thetaV = acos(VdotN);
  float alpha = max(thetaL, thetaV);
  float beta = min(thetaL, thetaV);
  
  // Azimuth difference
  vec3 Lproj = normalize(L - N * LdotN);
  vec3 Vproj = normalize(V - N * VdotN);
  float gamma = max(0.0, dot(Lproj, Vproj));
  
  return LdotN * (A + B * gamma * sin(alpha) * tan(beta));
}

// Kajiya-Kay Anisotropic Specular (for fibers)
float kajiyaKaySpecular(vec3 L, vec3 V, vec3 T, float power) {
  float TdotL = dot(T, L);
  float TdotV = dot(T, V);
  
  float sinTL = sqrt(1.0 - TdotL * TdotL);
  float sinTV = sqrt(1.0 - TdotV * TdotV);
  
  // Kajiya-Kay specular term
  float spec = sinTL * sinTV - TdotL * TdotV;
  return pow(max(spec, 0.0), power);
}

// Charlie Sheen (for velvet/cloth grazing highlights)
// From Sony Pictures Imageworks
float charlieD(float roughness, float NdotH) {
  float invR = 1.0 / roughness;
  float cos2h = NdotH * NdotH;
  float sin2h = 1.0 - cos2h;
  return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * 3.14159);
}

float ashikhminV(float NdotV, float NdotL) {
  return 1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV));
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

// Micro-shadowing term
float microShadowing(float fiberDensity, float NdotL, float shellIndex) {
  // Fibers at base receive less light
  float heightFactor = 1.0 - shellIndex;
  float shadow = exp(-fiberDensity * heightFactor * 2.0);
  
  // Additional shadowing at grazing angles
  shadow *= mix(0.3, 1.0, NdotL);
  
  return shadow;
}

// ============================================
// COMBINED FELT SHADING
// ============================================
vec3 feltBRDF(
  vec3 L,           // Light direction
  vec3 V,           // View direction  
  vec3 N,           // Surface normal
  vec3 T,           // Fiber tangent direction
  float roughness,  // Surface roughness (0.6-0.9 for felt)
  float density,    // Fiber density at this point
  float shellIndex, // Which shell layer (0 = base, 1 = tip)
  vec3 albedo,      // Base color
  vec3 sheenColor   // Sheen tint
) {
  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  
  // 1. Diffuse (Oren-Nayar for rough appearance)
  float diffuse = orenNayarDiffuse(L, V, N, roughness);
  
  // 2. Anisotropic fiber specular (Kajiya-Kay)
  float fiberSpec = kajiyaKaySpecular(L, V, T, 40.0);
  
  // 3. Sheen (grazing highlights)
  vec3 sheen = sheenBRDF(L, V, N, roughness, sheenColor);
  
  // 4. Micro-shadowing
  float shadow = microShadowing(density, NdotL, shellIndex);
  
  // Combine
  vec3 result = albedo * diffuse * shadow;
  result += fiberSpec * 0.15 * albedo;  // Fiber highlights tinted by albedo
  result += sheen * 0.3;                 // Sheen at grazing angles
  
  return result;
}

// ============================================
// MULTI-LIGHT SUPPORT
// ============================================
#define MAX_LIGHTS 4

struct Light {
  vec3 position;
  vec3 color;
  float intensity;
};

uniform Light uLights[MAX_LIGHTS];
uniform int uLightCount;

vec3 calculateLighting(
  vec3 worldPos,
  vec3 N,
  vec3 V,
  vec3 T,
  float roughness,
  float density,
  float shellIndex,
  vec3 albedo,
  vec3 sheenColor,
  float ao
) {
  vec3 totalLight = vec3(0.0);

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec3 L = normalize(uLights[i].position - worldPos);
    vec3 lightContrib = feltBRDF(L, V, N, T, roughness, density, shellIndex, albedo, sheenColor);
    lightContrib *= uLights[i].color * uLights[i].intensity;
    totalLight += lightContrib;
  }

  // Apply ambient occlusion
  totalLight *= ao;

  return totalLight;
}

// ============================================
// AMBIENT OCCLUSION FROM aoDepth TEXTURE
// ============================================
float getAmbientOcclusion(vec2 uv, float shellIndex, sampler2D aoDepthTex) {
  float bakedAO = texture2D(aoDepthTex, uv).r;

  // Shells closer to base receive more occlusion
  float depthAO = mix(0.4, 1.0, shellIndex);

  return bakedAO * depthAO;
}

// ============================================
// SHELL-TO-SHELL SHADOWING
// ============================================
float shellShadowing(float shellIndex, float NdotL, float density) {
  // Approximate shadow from fibers above this shell
  // Lower shells are more occluded by fibers above them
  float shadowLayers = (1.0 - shellIndex) * density;
  float shadow = exp(-shadowLayers * 1.5);

  // More shadowing at grazing light angles
  shadow *= mix(0.5, 1.0, NdotL);

  return shadow;
}

// ============================================
// IMAGE-BASED LIGHTING (IBL)
// ============================================
uniform samplerCube uEnvMap;
uniform float uEnvMapIntensity;

vec3 getIBLContribution(vec3 N, vec3 V, vec3 albedo, float roughness, float ao) {
  // Diffuse IBL - sample from heavily blurred mip
  vec3 irradiance = textureCube(uEnvMap, N, 6.0).rgb; // High mip = diffuse
  vec3 diffuseIBL = irradiance * albedo;

  // Specular IBL - roughness determines mip level
  vec3 R = reflect(-V, N);
  float mipLevel = roughness * 6.0; // 0 = sharp, 6 = diffuse
  vec3 prefilteredColor = textureCube(uEnvMap, R, mipLevel).rgb;

  // Simplified fresnel for felt (low reflectance)
  float NdotV = max(dot(N, V), 0.0);
  float fresnel = 0.04 + 0.06 * pow(1.0 - NdotV, 5.0); // Very low F0 for cloth

  vec3 specularIBL = prefilteredColor * fresnel;

  // Felt is mostly diffuse, minimal specular IBL
  vec3 ibl = diffuseIBL * 0.8 + specularIBL * 0.1;

  return ibl * ao * uEnvMapIntensity;
}
```

---

## 7. COLOR SPECIFICATION

### 7.1 Tennis Ball Yellow

Regulation tennis balls use **optic yellow** (officially "optic yellow" per ITF).

**Color Space Pipeline:**
1. Define colors in sRGB (what you see on screen)
2. Convert to linear space for shader math
3. Apply gamma correction (2.2) at final output

```javascript
// sRGB values (for reference/UI)
const TENNIS_BALL_YELLOW_SRGB = { r: 0.8, g: 0.9, b: 0.2 };

// Linear space values (USE THESE IN SHADER)
// Conversion: linear = pow(srgb, 2.2)
const TENNIS_BALL_YELLOW_LINEAR = new THREE.Color().setRGB(
  Math.pow(0.8, 2.2),  // 0.604
  Math.pow(0.9, 2.2),  // 0.787
  Math.pow(0.2, 2.2)   // 0.035
);

// Or let Three.js handle it with color management:
// THREE.ColorManagement.enabled = true;
// const color = new THREE.Color(0.8, 0.9, 0.2); // Auto-converted
```

```glsl
// In shader - always work in LINEAR space
uniform vec3 uAlbedo; // Expect linear-space input

// Final output - convert back to sRGB
fragColor.rgb = pow(finalColor, vec3(1.0 / 2.2));
```

### 7.2 Color Variation

Color should vary with:
- **Fiber depth**: Darker at base (less light penetration)
- **View angle**: Slightly brighter at grazing
- **Wear**: Whiter in high-contact areas (optional)

```glsl
vec3 modulateColor(vec3 baseColor, float shellIndex, float NdotV) {
  // Darken at fiber base
  float depthDarken = mix(0.7, 1.0, shellIndex);
  
  // Brighten at grazing angles
  float grazingBrighten = 1.0 + 0.1 * (1.0 - NdotV);
  
  return baseColor * depthDarken * grazingBrighten;
}
```

---

## 8. COMPLETE THREE.JS SETUP

```javascript
import * as THREE from 'three';

// ============================================
// TENNIS BALL CLASS
// ============================================
class TennisBall {
  constructor() {
    this.shellCount = 16;
    this.shellHeight = 0.15;
    this.ballRadius = 3.3;
    
    this.textures = {};
    this.mesh = null;
  }
  
  async init() {
    await this.loadTextures();
    this.createMesh();
    return this.mesh;
  }
  
  async loadTextures() {
    const loader = new THREE.TextureLoader();
    
    // Load or generate textures
    this.textures.fiberDensity = await this.generateFiberDensityTexture();
    this.textures.fiberDirection = await this.generateFiberDirectionTexture();
    this.textures.seamMask = await this.generateSeamTexture();
    
    // Set texture parameters
    Object.values(this.textures).forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }
  
  generateFiberDensityTexture() {
    // Generate via canvas or compute shader
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Use simplex noise library
    const imageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        
        // FBM noise
        let density = 0;
        let amplitude = 0.5;
        let frequency = 50;
        for (let i = 0; i < 5; i++) {
          density += amplitude * (noise.simplex2(u * frequency, v * frequency) * 0.5 + 0.5);
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        const idx = (y * size + x) * 4;
        imageData.data[idx] = density * 255;
        imageData.data[idx + 1] = density * 255;
        imageData.data[idx + 2] = density * 255;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    
    return new THREE.CanvasTexture(canvas);
  }
  
  createMesh() {
    const geometry = new THREE.SphereGeometry(this.ballRadius, 128, 128);

    // CRITICAL: Compute tangents for TBN matrix (fiber direction transform)
    geometry.computeTangents();
    
    // IMPORTANT: Shell rendering depth strategy
    // - Render shells from inside-out (base to tips)
    // - Use alpha discard (not blend) for fiber tips
    // - Keep depthWrite: true to prevent self-intersection artifacts
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uShellHeight: { value: this.shellHeight },
        uFiberDensity: { value: this.textures.fiberDensity },
        uFiberDirection: { value: this.textures.fiberDirection },
        uSeamMask: { value: this.textures.seamMask },
        uAoDepth: { value: this.textures.aoDepth }, // AO texture
        uAlbedo: { value: new THREE.Color().setRGB(0.604, 0.787, 0.035) }, // LINEAR space
        uSheenColor: { value: new THREE.Color().setRGB(1.0, 1.0, 0.9) },
        uRoughness: { value: 0.75 },
        uLights: { value: [] }, // Populated in update()
        uLightCount: { value: 0 },
        uEnvMap: { value: null },
        uEnvMapIntensity: { value: 0.3 },
        uCameraPosition: { value: new THREE.Vector3() }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: false, // Use alpha discard, not transparency blending
      side: THREE.FrontSide, // Only front faces (shells expand outward)
      depthWrite: true,
      depthTest: true
    });

    // Enable alpha-to-coverage for smoother fiber edges (if MSAA enabled)
    // material.alphaToCoverage = true;
    
    // Create instanced mesh for shells
    this.mesh = new THREE.InstancedMesh(geometry, material, this.shellCount);
    
    // Set shell indices
    const shellIndices = new Float32Array(this.shellCount);
    for (let i = 0; i < this.shellCount; i++) {
      shellIndices[i] = i / (this.shellCount - 1);
      
      // Each instance at same position (vertex shader handles offset)
      const matrix = new THREE.Matrix4();
      this.mesh.setMatrixAt(i, matrix);
    }
    
    geometry.setAttribute('shellIndex',
      new THREE.InstancedBufferAttribute(shellIndices, 1)
    );
  }
  
  update(camera) {
    this.mesh.material.uniforms.uCameraPosition.value.copy(camera.position);
  }
}
```

---

## 9. SEAM CURVE IMPLEMENTATION

### 9.1 Generate Seam Path (JavaScript)

```javascript
function generateSeamCurve(radius, segments = 256) {
  const points = [];

  // Tennis ball seam parameters (matches Section 3.2)
  const A = 0.44; // Seam amplitude in radians (~25°)

  // Seam completes in 4π (two loops around sphere)
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 4;

    // Spherical coordinate parameterization
    const phi = Math.PI / 2 - (Math.PI / 2 - A) * Math.cos(t);
    const theta = t / 2 + A * Math.sin(2 * t);

    // Convert to Cartesian on sphere surface
    points.push(new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    ));
  }

  return new THREE.CatmullRomCurve3(points, true);
}

function generateSeamMaskTexture(curve, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  
  // Draw seam in UV space
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 8;  // Seam width
  ctx.beginPath();
  
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const point = curve.getPoint(t);
    
    // Convert 3D point to UV (spherical projection)
    const u = 0.5 + Math.atan2(point.z, point.x) / (2 * Math.PI);
    const v = 0.5 - Math.asin(point.y / Math.sqrt(point.x*point.x + point.y*point.y + point.z*point.z)) / Math.PI;
    
    if (i === 0) {
      ctx.moveTo(u * size, v * size);
    } else {
      ctx.lineTo(u * size, v * size);
    }
  }
  ctx.stroke();
  
  return new THREE.CanvasTexture(canvas);
}
```

---

## 10. LIGHTING REQUIREMENTS

### 10.1 Validation Lighting Setup

To properly validate the felt material:

```javascript
// Key light (main directional)
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(5, 5, 5);

// Fill light (softer, opposite side)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-3, 2, -3);

// Rim light (grazing angle to show sheen)
const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
rimLight.position.set(0, -2, 5);

// HDRI environment (critical for realistic reflections)
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
scene.environment = envMap;
```

### 10.2 Required Behaviors

The material MUST exhibit:

1. **Rotation-dependent appearance**: Rotating the ball changes highlight patterns
2. **Fiber breakup in highlights**: No smooth specular; irregular from fibers
3. **Soft shadow falloff**: Gradual transition, not hard edge
4. **Grazing sheen**: Visible brightening at edges
5. **Seam visibility**: Raised seam catches light differently

---

## 11. PERFORMANCE OPTIMIZATION

### 11.1 Shell Count Scaling

```javascript
function getOptimalShellCount() {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  
  // Adjust based on GPU
  if (gpuVendor.includes('Apple')) return 12;  // M1/M2 can handle more
  if (gpuVendor.includes('NVIDIA')) return 20;
  if (gpuVendor.includes('Intel')) return 8;   // Integrated GPUs
  return 12;  // Default
}
```

### 11.2 LOD Strategy

```javascript
// Distance-based shell reduction
function updateLOD(distance) {
  if (distance > 50) {
    // Far: use simplified material, no shells
    ball.material = simpleMaterial;
  } else if (distance > 20) {
    // Medium: reduce shells
    ball.material.uniforms.uShellCount.value = 8;
  } else {
    // Close: full quality
    ball.material.uniforms.uShellCount.value = 16;
  }
}
```

---

## 12. VALIDATION CRITERIA

### 12.1 Visual Pass/Fail Tests

| Test | Pass Condition | Fail Indicator |
|------|----------------|----------------|
| Rotation test | Appearance changes with rotation | Static look regardless of angle |
| Grazing test | Visible sheen at edges | No edge brightening |
| Seam test | Seam visually distinct, raised | Seam looks painted on |
| Fiber test | Non-uniform surface texture | Smooth/plastic appearance |
| Shadow test | Soft gradients in shadows | Hard shadow edges |

### 12.2 Perceptual Realism Test

1. Render ball at 1080p
2. Place next to reference photo of real tennis ball
3. Match lighting angle
4. Show to observer unfamiliar with the project
5. **PASS**: Observer cannot identify CG in < 3 seconds
6. **FAIL**: Immediate identification of CG version

---

## 13. FAILURE MODES & DEBUGGING

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| **Plastic look** | Missing fiber BRDF, using stock PBR | Implement custom Kajiya-Kay + sheen |
| **Flat appearance** | No shell layers | Increase shell count, verify offset |
| **Powdery/dusty** | Incorrect alpha threshold | Adjust discard threshold curve |
| **Uniform surface** | Missing fiber direction map | Generate and apply direction texture |
| **Game-like** | Using MeshStandardMaterial | Switch to full custom ShaderMaterial |
| **Banding** | Insufficient shells | Increase count or add dithering |
| **Slow FPS** | Too many shells | Reduce count, implement LOD |

---

## 14. COMPLETE SHADER CODE

### 14.1 Vertex Shader

```glsl
#version 300 es
precision highp float;

// Attributes
in vec3 position;
in vec3 normal;
in vec2 uv;
in vec4 tangent;      // xyz = tangent, w = handedness (from computeTangents())
in float shellIndex;  // Per-instance shell layer (0-1 normalized)

// Uniforms
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uShellHeight;
uniform sampler2D uFiberDensity;

// Varyings
out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vUv;
out float vShellIndex;
out float vFiberDensity;
out mat3 vTBN;        // Tangent-Bitangent-Normal matrix

void main() {
  vUv = uv;
  vShellIndex = shellIndex;

  // Build TBN matrix for transforming fiber directions to world space
  vec3 T = normalize(normalMatrix * tangent.xyz);
  vec3 N = normalize(normalMatrix * normal);
  vec3 B = normalize(cross(N, T) * tangent.w); // w = handedness
  vTBN = mat3(T, B, N);

  // Sample fiber density (for potential vertex-level variation)
  vFiberDensity = texture(uFiberDensity, uv).r;

  // Offset position along normal based on shell index
  float offset = shellIndex * uShellHeight;
  vec3 shellPos = position + normal * offset;

  // Transform to world space
  vec4 worldPos = modelMatrix * vec4(shellPos, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = N; // Already transformed above

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

### 14.2 Fragment Shader

```glsl
#version 300 es
precision highp float;

// ============================================
// VARYINGS
// ============================================
in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vUv;
in float vShellIndex;
in float vFiberDensity;
in mat3 vTBN;

// ============================================
// UNIFORMS
// ============================================
uniform vec3 uAlbedo;           // LINEAR space color
uniform vec3 uSheenColor;
uniform float uRoughness;
uniform vec3 uCameraPosition;
uniform sampler2D uFiberDensity;
uniform sampler2D uFiberDirection;
uniform sampler2D uSeamMask;
uniform sampler2D uAoDepth;
uniform samplerCube uEnvMap;
uniform float uEnvMapIntensity;

// Multi-light support
#define MAX_LIGHTS 4
struct Light {
  vec3 position;
  vec3 color;
  float intensity;
};
uniform Light uLights[MAX_LIGHTS];
uniform int uLightCount;

// Output
out vec4 fragColor;

// ============================================
// BRDF FUNCTIONS (from Section 6.2)
// ============================================

float orenNayarDiffuse(vec3 L, vec3 V, vec3 N, float roughness) {
  float LdotN = max(dot(L, N), 0.0);
  float VdotN = max(dot(V, N), 0.0);

  float sigma2 = roughness * roughness;
  float A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
  float B = 0.45 * sigma2 / (sigma2 + 0.09);

  float thetaL = acos(LdotN);
  float thetaV = acos(VdotN);
  float alpha = max(thetaL, thetaV);
  float beta = min(thetaL, thetaV);

  vec3 Lproj = normalize(L - N * LdotN);
  vec3 Vproj = normalize(V - N * VdotN);
  float gamma = max(0.0, dot(Lproj, Vproj));

  return LdotN * (A + B * gamma * sin(alpha) * tan(beta));
}

float kajiyaKaySpecular(vec3 L, vec3 V, vec3 T, float power) {
  float TdotL = dot(T, L);
  float TdotV = dot(T, V);
  float sinTL = sqrt(1.0 - TdotL * TdotL);
  float sinTV = sqrt(1.0 - TdotV * TdotV);
  float spec = sinTL * sinTV - TdotL * TdotV;
  return pow(max(spec, 0.0), power);
}

float charlieD(float roughness, float NdotH) {
  float invR = 1.0 / roughness;
  float cos2h = NdotH * NdotH;
  float sin2h = 1.0 - cos2h;
  return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * 3.14159);
}

float ashikhminV(float NdotV, float NdotL) {
  return 1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV));
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

float microShadowing(float fiberDensity, float NdotL, float shellIndex) {
  float heightFactor = 1.0 - shellIndex;
  float shadow = exp(-fiberDensity * heightFactor * 2.0);
  shadow *= mix(0.3, 1.0, NdotL);
  return shadow;
}

float shellShadowing(float shellIndex, float NdotL, float density) {
  float shadowLayers = (1.0 - shellIndex) * density;
  float shadow = exp(-shadowLayers * 1.5);
  shadow *= mix(0.5, 1.0, NdotL);
  return shadow;
}

vec3 feltBRDF(vec3 L, vec3 V, vec3 N, vec3 T, float roughness,
              float density, float shellIndex, vec3 albedo, vec3 sheenColor) {
  float NdotL = max(dot(N, L), 0.0);

  float diffuse = orenNayarDiffuse(L, V, N, roughness);
  float fiberSpec = kajiyaKaySpecular(L, V, T, 40.0);
  vec3 sheen = sheenBRDF(L, V, N, roughness, sheenColor);
  float shadow = microShadowing(density, NdotL, shellIndex);
  float shellShadow = shellShadowing(shellIndex, NdotL, density);

  vec3 result = albedo * diffuse * shadow * shellShadow;
  result += fiberSpec * 0.15 * albedo;
  result += sheen * 0.3;

  return result;
}

// ============================================
// IBL CONTRIBUTION
// ============================================
vec3 getIBLContribution(vec3 N, vec3 V, vec3 albedo, float roughness, float ao) {
  vec3 irradiance = texture(uEnvMap, N).rgb;
  vec3 diffuseIBL = irradiance * albedo;

  vec3 R = reflect(-V, N);
  float mipLevel = roughness * 6.0;
  vec3 prefilteredColor = textureLod(uEnvMap, R, mipLevel).rgb;

  float NdotV = max(dot(N, V), 0.0);
  float fresnel = 0.04 + 0.06 * pow(1.0 - NdotV, 5.0);
  vec3 specularIBL = prefilteredColor * fresnel;

  vec3 ibl = diffuseIBL * 0.8 + specularIBL * 0.1;
  return ibl * ao * uEnvMapIntensity;
}

// ============================================
// MAIN
// ============================================
void main() {
  // Re-sample fiber density for fragment-level precision
  float density = texture(uFiberDensity, vUv).r;

  // View-dependent density: more fibers visible at grazing angles
  vec3 N = normalize(vTBN[2]); // Normal from TBN matrix
  vec3 V = normalize(uCameraPosition - vWorldPosition);
  float NdotV = max(dot(N, V), 0.0);
  float viewDensityBoost = mix(1.2, 1.0, NdotV);
  density *= viewDensityBoost;

  // Alpha discard for fiber tips (quadratic falloff)
  float threshold = mix(0.05, 0.95, vShellIndex * vShellIndex);
  if (density < threshold) {
    discard;
  }

  // Get fiber tangent direction using TBN matrix (CORRECT way)
  vec2 fiberDir2D = texture(uFiberDirection, vUv).rg * 2.0 - 1.0;
  // Add fiber curvature variation with depth
  float curvature = 0.1 * vShellIndex;
  fiberDir2D = normalize(fiberDir2D + vec2(curvature, curvature * 0.5));
  vec3 T = normalize(vTBN * vec3(fiberDir2D, 0.0));

  // Sample AO texture
  float ao = texture(uAoDepth, vUv).r;
  ao *= mix(0.4, 1.0, vShellIndex); // Depth-based AO

  // Modulate albedo by shell depth (darker at base)
  vec3 albedo = uAlbedo * mix(0.7, 1.0, vShellIndex);

  // Accumulate lighting from all lights
  vec3 color = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec3 L = normalize(uLights[i].position - vWorldPosition);
    vec3 lightContrib = feltBRDF(L, V, N, T, uRoughness, density, vShellIndex, albedo, uSheenColor);
    lightContrib *= uLights[i].color * uLights[i].intensity;
    color += lightContrib;
  }

  // Apply ambient occlusion
  color *= ao;

  // Add IBL contribution
  color += getIBLContribution(N, V, albedo, uRoughness, ao);

  // Ambient fill (minimal)
  color += albedo * 0.05;

  // Gamma correction (linear -> sRGB)
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
```

---

## 15. EXECUTION CHECKLIST

For an LLM agent implementing this spec:

### Phase 1: Setup
- [ ] Create Three.js scene with WebGL2 renderer
- [ ] Set up camera and orbit controls
- [ ] Create base sphere geometry (128 segments)
- [ ] Implement basic lighting (key + fill + rim)

### Phase 2: Textures
- [ ] Generate fiber density texture (FBM noise)
- [ ] Generate fiber direction texture
- [ ] Generate seam mask texture
- [ ] Load/create all textures with correct formats

### Phase 3: Shell Rendering
- [ ] Create InstancedMesh with shell count instances
- [ ] Implement vertex shader with normal offset
- [ ] Implement alpha discard in fragment shader
- [ ] Verify shells render at different depths

### Phase 4: BRDF
- [ ] Implement Oren-Nayar diffuse
- [ ] Implement Kajiya-Kay anisotropic specular
- [ ] Implement Charlie sheen term
- [ ] Implement micro-shadowing
- [ ] Combine into feltBRDF function

### Phase 5: Seam
- [ ] Generate seam curve mathematically
- [ ] Create seam mask and distance textures
- [ ] Modulate fiber density near seam
- [ ] Align fiber direction with seam tangent

### Phase 6: Validation
- [ ] Rotation test: appearance changes
- [ ] Grazing test: sheen visible
- [ ] Seam test: visually distinct
- [ ] Performance test: 60fps on target GPU

---

## 16. REFERENCES

1. **Shell Rendering**: Kajiya & Kay, "Rendering fur with three dimensional textures" (1989)
2. **Cloth BRDF**: Estevez & Kulla, "Production Friendly Microfacet Sheen BRDF" (SIGGRAPH 2017)
3. **Oren-Nayar**: Oren & Nayar, "Generalization of Lambert's reflectance model" (1994)
4. **Tennis Ball Theorem**: Arnold, V.I., "Topological invariants of plane curves and caustics" (1994)
5. **Disney BRDF**: Burley, "Physically Based Shading at Disney" (SIGGRAPH 2012)
6. **Three.js Docs**: https://threejs.org/docs/
7. **GLSL Reference**: https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language

---

## 17. SUMMARY FOR LLM INGESTION

```
REQUIREMENTS:
- WebGL2 + Three.js
- Shell rendering (8-20 layers)
- Custom felt BRDF (Oren-Nayar + Kajiya-Kay + Sheen)
- Fiber density/direction textures
- Seam geometry via parametric curve

DO NOT:
- Use MeshStandardMaterial
- Use single normal map only
- Skip shell rendering
- Ignore micro-shadowing
- Use flat albedo

MUST:
- Implement multi-layer shells
- Generate procedural fiber textures
- Use custom ShaderMaterial
- Include anisotropic highlights
- Modulate color by fiber depth
- Create proper seam geometry
- Validate with rotation test
```

---

*Document Version: 1.0*
*Generated for LLM implementation agents*