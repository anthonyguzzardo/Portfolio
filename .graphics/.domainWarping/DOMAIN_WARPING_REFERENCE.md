# Domain Warping Quick Reference

## Terms

**domain warping** - distorting coordinate space with noise before sampling
**fbm** - fractal Brownian motion, layered noise at different frequencies
**octave** - single layer of noise in fbm stack
**warp cascade** - feeding warped coordinates into subsequent warps
**advection** - transport of values through a flow field
**curl noise** - divergence-free noise for fluid-like motion
**displacement** - offsetting geometry or coordinates by noise value

## Core Formula

```glsl
// Basic domain warp
vec2 warp = vec2(noise(p), noise(p + offset));
float result = noise(p + warp * strength);
```

## Cascading Warps (Paint Effect)

```glsl
// First warp - large folds
vec2 w1 = vec2(
  noise(p * 1.0),
  noise(p * 1.0 + vec2(5.2, 1.3))
) * 0.5;

// Second warp - uses first warp
vec2 w2 = vec2(
  noise(p * 2.0 + w1),
  noise(p * 2.0 + w1 + vec2(1.7, 9.2))
) * 0.25;

// Third warp - uses both
vec2 w3 = vec2(
  noise(p * 4.0 + w1 + w2),
  noise(p * 4.0 + w1 + w2 + vec2(4.1, 3.7))
) * 0.12;

// Final warped position
vec2 warped = p + w1 + w2 + w3;
```

## Warp Strengths by Layer

```
Layer 1: 0.3-0.5 (large scale folds)
Layer 2: 0.15-0.3 (medium compression)
Layer 3: 0.08-0.15 (fine detail)
```

## Frequency Multipliers

```
Layer 1: 1.0-2.0x base frequency
Layer 2: 2.0-4.0x base frequency
Layer 3: 4.0-8.0x base frequency
```

## Offset Vectors (Decorrelation)

```glsl
// Use arbitrary offsets to decorrelate x/y noise
vec2(5.2, 1.3)   // common IQ offset
vec2(1.7, 9.2)   // second component
vec2(8.3, 2.8)   // third component
vec2(4.1, 3.7)   // fourth component
```

## Animation Drift

```glsl
// Slow organic drift using prime ratios
vec2 drift = vec2(
  sin(t * 0.13) * 0.3 + cos(t * 0.09) * 0.2,
  cos(t * 0.11) * 0.3 + sin(t * 0.07) * 0.2
);

// Apply to first warp layer
vec2 p1 = p + drift;
```

## Common Patterns

```glsl
// Marble texture
warp(p) -> warp(p + warp1) -> sin(x + result)

// Clouds/smoke
warp(p) -> fbm(warped_p)

// Paint/fluid
3-layer cascade warp -> sample regions

// Fire
vertical bias in warp + upward drift
```

## Visual Effects by Warp Count

```
1 warp: subtle organic distortion
2 warps: visible folding, compression
3 warps: complex paint-like behavior
4+ warps: chaotic, potentially muddy
```

## Intensity Separation

```glsl
// Keep falloff symmetrical, warp only pattern
float baseIntensity = falloff(original_dist);
float pattern = noise(warped_pos);
float final = baseIntensity * pattern;
```

## Performance Notes

```
- Each warp layer = 2 noise calls (x and y)
- 3-layer warp = 6 noise evaluations minimum
- Noise is ALU-heavy, texture lookups can substitute
- Reduce octaves at distance for LOD
```

## Simplex vs Perlin for Warping

```
Simplex: fewer directional artifacts, better for warping
Perlin: grid-aligned artifacts can show through warps
Value noise: cheapest but blockiest
```

## Glossy Effect Techniques

### Caustic Highlights
```glsl
// Shimmering refractive highlights
float caustics = snoise(warpedPos * 3.0 + vec2(t * 0.1, t * 0.13));
caustics = smoothstep(0.1, 0.7, caustics) * intensity * 0.5;
finalColor += accentColor * caustics * 0.4;
```

### Warp Modulation
```glsl
// Intensity varies based on warped domain (not uniform)
float warpMod = snoise(warpedPos * 1.5) * 0.3 + 0.85;
float intensity = baseIntensity * warpMod;
```

### Multi-Accent Color Mixing
```glsl
// Blend 3 related colors for richness
float colorNoise = snoise(warpedPos * 2.0) * 0.5 + 0.5;
vec3 glow = mix(accent1, mix(accent2, accent3, colorNoise), colorNoise * 0.7);
```

### Responsive Borders
```glsl
// Edges respond to lighting intensity
float borderIntensity = intensity + caustics;
vec3 borderColor = mix(base * 0.5, base * 1.2, borderIntensity);
borderColor += accent * borderIntensity * 0.1;
```

## Glossy Layer Order

```
1. Domain warp (3-layer cascade)
2. Base intensity from ORIGINAL coords (symmetry)
3. Organic regions from WARPED coords
4. Warp modulation (intensity variation)
5. Caustic highlights
6. Multi-accent color mixing
7. Build final color with glow + caustics
8. Responsive borders (if applicable)
```
