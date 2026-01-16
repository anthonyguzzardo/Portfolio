# TENNIS_INDEX.md

Quick reference index for `TENNIS.md`. Use `grep -n "KEYWORD" TENNIS.md` to jump to sections.

---

## SECTION MAP

| Section | Line Search | Description |
|---------|-------------|-------------|
| 1. Constraints | `## 1. CONSTRAINTS` | WebGL2 limits, target phenomena |
| 2. Principle | `## 2. FUNDAMENTAL` | Why standard PBR fails |
| 3. Geometry | `## 3. GEOMETRY` | Sphere + seam specs |
| 4. Shell Rendering | `## 4. SHELL` | Multi-layer implementation |
| 5. Textures | `## 5. TEXTURE` | Required maps, generation |
| 6. BRDF | `## 6. BRDF` | Custom felt shader math |
| 7. Color | `## 7. COLOR` | Tennis ball yellow specs |
| 8. Three.js Setup | `## 8. COMPLETE THREE` | Full class implementation |
| 9. Seam Curve | `## 9. SEAM CURVE` | Parametric equations |
| 10. Lighting | `## 10. LIGHTING` | Validation setup |
| 11. Performance | `## 11. PERFORMANCE` | LOD, shell scaling |
| 12. Validation | `## 12. VALIDATION` | Pass/fail tests |
| 13. Debugging | `## 13. FAILURE` | Symptom → fix table |
| 14. Shaders | `## 14. COMPLETE SHADER` | Full GLSL code |
| 15. Checklist | `## 15. EXECUTION` | Step-by-step tasks |
| 16. References | `## 16. REFERENCES` | Academic sources |
| 17. Summary | `## 17. SUMMARY` | LLM quick-start |

---

## CODE BLOCK INDEX

| Code Type | Grep Pattern | Purpose |
|-----------|--------------|---------|
| Sphere geometry | `SphereGeometry` | Base mesh creation |
| Shell vertex shader | `shellPosition = position` | Normal offset logic |
| TBN matrix | `vTBN = mat3` | Tangent space transform |
| Alpha discard | `discard;` | Fiber tip transparency |
| Oren-Nayar | `orenNayarDiffuse` | Rough diffuse BRDF |
| Kajiya-Kay | `kajiyaKaySpecular` | Anisotropic fiber highlights |
| Charlie Sheen | `charlieD` | Velvet grazing term |
| Micro-shadow | `microShadowing` | Fiber base darkening |
| Shell-to-shell shadow | `shellShadowing` | Inter-layer occlusion |
| Combined BRDF | `feltBRDF` | Full shading function |
| Multi-light | `MAX_LIGHTS` | Multiple light sources |
| IBL sampling | `getIBLContribution` | Environment lighting |
| AO integration | `uAoDepth` | Ambient occlusion |
| Seam parametric | `phi.*theta\|seamPoint` | Seam curve math |
| Fiber density gen | `generateFiberDensity` | Procedural texture |
| Fiber direction | `generateFiberDirection` | Tangent map |
| InstancedMesh | `InstancedMesh` | Shell rendering setup |
| Seam mask | `generateSeamMaskTexture` | UV-space seam |
| Color space | `LINEAR space` | sRGB/linear handling |

---

## KEYWORD QUICK SEARCH

```bash
# Find all uniforms
grep -n "uniform" TENNIS.md

# Find all texture references
grep -n "sampler2D\|Texture" TENNIS.md

# Find mathematical formulas
grep -n "Math\.\|sin\|cos\|sqrt\|pow" TENNIS.md

# Find Three.js specific code
grep -n "THREE\." TENNIS.md

# Find GLSL functions
grep -n "void.*(" TENNIS.md

# Find validation criteria
grep -n "PASS\|FAIL\|Test" TENNIS.md

# Find performance notes
grep -n -i "fps\|performance\|LOD\|optimize" TENNIS.md

# Find color values
grep -n "0x\|rgb\|Color\|vec3(" TENNIS.md

# Find TBN/tangent handling
grep -n "TBN\|tangent\|computeTangents" TENNIS.md

# Find lighting/IBL
grep -n "IBL\|envMap\|Light\[" TENNIS.md

# Find AO/occlusion
grep -n "ao\|occlusion\|AoDepth" TENNIS.md

# Find color space handling
grep -n "LINEAR\|sRGB\|gamma\|2.2" TENNIS.md
```

---

## CONSTANT VALUES

| Constant | Value | Location |
|----------|-------|----------|
| Ball radius | `3.3` cm | Section 3.1 |
| Sphere segments | `128` | Section 3.1 |
| Shell count | `8-20` | Section 4.1 |
| Shell height | `0.15` | Section 4.1 |
| Roughness | `0.6-0.9` | Section 6.2 |
| Tennis yellow (sRGB) | `0.8, 0.9, 0.2` | Section 7.1 |
| Tennis yellow (linear) | `0.604, 0.787, 0.035` | Section 7.1 |
| Seam amplitude A | `0.44` rad | Section 3.2 |
| Seam curve type | Spherical (φ,θ) | Section 3.2 |
| Seam t range | `0` to `4π` | Section 3.2 |
| Max lights | `4` | Section 6.2 |

---

## TEXTURE SPECIFICATIONS

| Texture | Resolution | Format | Grep |
|---------|------------|--------|------|
| albedo | 1024² | RGB8 | `albedo` |
| fiberDensity | 512² | R8 | `fiberDensity` |
| fiberDirection | 512² | RG16F | `fiberDirection` |
| microNormal | 1024² | RGB8 | `microNormal` |
| seamMask | 512² | R8 | `seamMask` |
| aoDepth | 512² | R8 | `aoDepth` |

---

## FAILURE DIAGNOSIS

| Symptom | Grep for fix |
|---------|--------------|
| Plastic look | `Kajiya-Kay\|sheen` |
| Flat appearance | `SHELL_COUNT\|offset` |
| Powdery | `threshold\|discard` |
| Uniform surface | `fiberDirection` |
| Game-like | `ShaderMaterial` |
| Banding | `shell count\|dither` |
| Slow FPS | `LOD\|Performance` |
| Wrong highlights | `TBN\|computeTangents` |
| Washed colors | `LINEAR\|gamma\|2.2` |
| No ambient depth | `AoDepth\|occlusion` |
| Single light | `MAX_LIGHTS\|uLights` |
| Z-fighting | `transparent\|depthWrite` |

---

## IMPLEMENTATION ORDER

```
1. grep "Phase 1" TENNIS.md   → Basic Three.js setup
2. grep "Phase 2" TENNIS.md   → Texture generation
3. grep "Phase 3" TENNIS.md   → Shell rendering
4. grep "Phase 4" TENNIS.md   → BRDF implementation
5. grep "Phase 5" TENNIS.md   → Seam geometry
6. grep "Phase 6" TENNIS.md   → Validation
```

---

## EXTERNAL DEPENDENCIES

| Dependency | Purpose | Grep |
|------------|---------|------|
| Three.js | Renderer | `THREE.` |
| Simplex noise | Texture gen | `simplex\|snoise` |
| HDRI loader | Environment | `pmremGenerator\|envMap` |

---

## FILE STRUCTURE (suggested)

```
project/
├── index.html
├── src/
│   ├── TennisBall.js        → grep "class TennisBall"
│   ├── shaders/
│   │   ├── felt.vert        → grep "Vertex Shader"
│   │   └── felt.frag        → grep "Fragment Shader"
│   └── textures/
│       └── generators.js    → grep "generate.*Texture"
└── assets/
    └── hdri/
```