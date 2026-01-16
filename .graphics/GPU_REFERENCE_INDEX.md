# GPU Graphics Quick Reference

## Terms

**triangle** - fundamental rendering primitive, three vertices, always coplanar
**vertex** - point in 3D space with position and attributes
**mesh** - collection of triangles forming a 3D object
**rasterization** - converting triangles to pixels
**fragment** - pixel candidate during rendering
**shader** - program running on GPU
**vertex shader** - transforms vertex positions
**fragment shader** - computes pixel colors
**SDF** - signed distance function, returns distance to nearest surface
**ray marching** - stepping along rays evaluating distance functions
**ray tracing** - computing ray-geometry intersections
**normal** - perpendicular vector to surface, used for lighting
**UV coordinates** - 2D texture mapping coordinates
**texel** - texture pixel
**framebuffer** - memory storing rendered image
**depth buffer** - stores distance per pixel for occlusion
**draw call** - CPU command to GPU to render geometry

## Pipeline Stages

```
vertices -> vertex shader -> rasterization -> fragment shader -> framebuffer
```

## SDF Formulas

```glsl
// sphere
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// box
float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// plane
float sdPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

// cylinder
float sdCylinder(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// torus
float sdTorus(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    return length(q) - r;
}
```

## SDF Operations

```glsl
// union
min(a, b)

// intersection
max(a, b)

// subtraction
max(a, -b)

// smooth union
float smoothMin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// repetition
vec3 rep = mod(p + 0.5 * spacing, spacing) - 0.5 * spacing;

// displacement
sdf(p) + noise(p) * amplitude
```

## Ray March Loop

```glsl
float t = 0.0;
for (int i = 0; i < MAX_STEPS; i++) {
    vec3 pos = ro + rd * t;
    float d = sceneSDF(pos);
    if (d < EPSILON) break;
    t += d;
    if (t > MAX_DIST) break;
}
```

## Common Constants

```glsl
MAX_STEPS = 100
EPSILON = 0.001
MAX_DIST = 100.0
```

## Normal Calculation (SDF)

```glsl
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
        sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
        sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
    ));
}
```

## Triangle Facts

- 3 points always coplanar
- quads split into 2 triangles
- n-gon splits into n-2 triangles
- GPU hardware optimized for triangles
- curved surfaces approximated by triangle count

## Coordinate Systems

```
screen space: pixels, origin top-left or bottom-left
NDC: normalized device coordinates, -1 to 1
world space: scene units
object space: local to mesh
view space: relative to camera
clip space: after projection, before perspective divide
```

## Data Types (GLSL)

```glsl
float   // scalar
vec2    // 2D vector
vec3    // 3D vector
vec4    // 4D vector / RGBA
mat3    // 3x3 matrix
mat4    // 4x4 matrix
sampler2D // texture
```

## Swizzling

```glsl
vec3 v = vec3(1.0, 2.0, 3.0);
v.xy   // vec2(1.0, 2.0)
v.zyx  // vec3(3.0, 2.0, 1.0)
v.xxx  // vec3(1.0, 1.0, 1.0)
```

## Units

```
DXA: 1440 = 1 inch (document)
EMU: 914400 = 1 inch (document graphics)
pixels: screen dependent
world units: arbitrary, typically meters
```