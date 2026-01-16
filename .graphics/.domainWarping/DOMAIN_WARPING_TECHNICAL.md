# Domain Warping: Technical Deep Dive

## What Is Domain Warping?

Domain warping is a procedural technique where you distort the coordinate space itself before sampling a function. Instead of just evaluating `noise(position)`, you first offset the position by another noise value: `noise(position + noise(position) * strength)`.

The result: organic folding, stretching, and compression that mimics natural phenomena like marble veins, smoke, flowing paint, or biological patterns.

This technique was popularized by Inigo Quilez (IQ) and has become fundamental in procedural graphics.

---

## The Core Insight

Traditional noise gives you bumpy terrain. Domain warping gives you *folded* terrain.

When you warp coordinates:
- Areas where noise pushes outward appear to **expand**
- Areas where noise pushes inward appear to **compress**
- The transition zones create **folds** where patterns wrap around each other

This is why it looks like paint being pushed around - the mathematics naturally create conservation-like behavior where expansion in one region implies compression in neighbors.

---

## Basic Implementation

### Single Warp

```glsl
float basicWarp(vec2 p) {
    // Create warp vector from noise
    vec2 warp = vec2(
        noise(p),
        noise(p + vec2(5.2, 1.3))  // offset to decorrelate
    );

    // Sample noise at warped position
    return noise(p + warp * 0.5);
}
```

The offset `vec2(5.2, 1.3)` ensures the x and y warp components are uncorrelated - without it, you'd get diagonal artifacts.

### Cascading Warps (The Paint Effect)

The magic happens when warps feed into each other:

```glsl
vec2 paintWarp(vec2 p, float time) {
    // Slow drift for animation
    vec2 drift = vec2(
        sin(time * 0.13) * 0.3,
        cos(time * 0.11) * 0.3
    );

    // Layer 1: Large-scale folds
    vec2 p1 = p * 1.5 + drift;
    vec2 w1 = vec2(
        noise(p1),
        noise(p1 + vec2(5.2, 1.3))
    ) * 0.4;

    // Layer 2: Medium compression (uses w1)
    vec2 p2 = p * 2.5 + w1 + drift * 0.7;
    vec2 w2 = vec2(
        noise(p2 + vec2(1.7, 9.2)),
        noise(p2 + vec2(8.3, 2.8))
    ) * 0.25;

    // Layer 3: Fine detail (uses w1 + w2)
    vec2 p3 = p * 4.0 + w1 + w2 + drift * 0.5;
    vec2 w3 = vec2(
        noise(p3 + vec2(4.1, 3.7)),
        noise(p3 + vec2(2.9, 7.1))
    ) * 0.12;

    // Combined warped position
    return p + w1 + w2 + w3;
}
```

Each layer:
1. Operates at higher frequency (more detail)
2. Has lower strength (less displacement)
3. Incorporates previous warps (creating interdependence)

---

## Why Cascading Works

Consider what happens geometrically:

**Layer 1** creates broad folds - large regions pushed in similar directions.

**Layer 2** adds medium-scale variation *on top of* the already-folded space. The folds themselves get folded.

**Layer 3** adds fine wrinkles to the already-complex surface.

This recursive folding is what creates the paint-like behavior. It's similar to how kneading dough creates complex layered structures through repeated folding.

---

## Animation Without Directional Drift

A common mistake is animating with linear time:

```glsl
// BAD: Creates directional drift
vec2 warp = vec2(noise(p + time * 0.5), noise(p + time * 0.3));
```

This pushes the pattern uniformly in one direction. Instead, use circular or Lissajous motion:

```glsl
// GOOD: Swirling, non-directional motion
vec2 drift = vec2(
    sin(time * 0.13) * 0.3 + cos(time * 0.09) * 0.2,
    cos(time * 0.11) * 0.3 + sin(time * 0.07) * 0.2
);
```

Using prime-ratio frequencies (0.07, 0.09, 0.11, 0.13) ensures the pattern doesn't visibly repeat.

---

## Separating Falloff from Warp

If you use warped coordinates for distance-based falloff, you'll get asymmetric brightness:

```glsl
// PROBLEM: Warp biases the falloff
float warpedDist = length(warpedPos);
float intensity = smoothstep(0.5, 0.0, warpedDist);  // Asymmetric!
```

Solution: Use original coordinates for falloff, warped coordinates for pattern:

```glsl
// SOLUTION: Symmetrical falloff, warped pattern
float originalDist = length(originalPos);
float baseFalloff = smoothstep(0.5, 0.0, originalDist);  // Symmetrical
float pattern = noise(warpedPos);
float intensity = baseFalloff * pattern;
```

---

## Typical Parameters

### Warp Strengths
| Layer | Strength | Purpose |
|-------|----------|---------|
| 1 | 0.3 - 0.5 | Large folds |
| 2 | 0.15 - 0.3 | Medium compression |
| 3 | 0.08 - 0.15 | Fine detail |

### Frequency Multipliers
| Layer | Frequency | Scale |
|-------|-----------|-------|
| 1 | 1.0 - 2.0x | Broad features |
| 2 | 2.0 - 4.0x | Medium detail |
| 3 | 4.0 - 8.0x | Fine wrinkles |

---

## Common Applications

### Marble/Stone
```glsl
vec2 warped = domainWarp(p);
float veins = sin(p.x * 10.0 + noise(warped) * 5.0);
```

### Smoke/Clouds
```glsl
vec2 warped = domainWarp(p + vec2(0, time * 0.2));  // Upward drift
float density = fbm(warped);
```

### Fire
```glsl
vec2 warped = domainWarp(p);
warped.y += time * 0.5;  // Strong upward motion
float flame = fbm(warped) * (1.0 - p.y);  // Fade at top
```

### Organic/Biological
```glsl
vec2 warped = cascadeWarp(p, time * 0.1);  // Slow
float cells = voronoi(warped * 5.0);
```

### Paint/Fluid
```glsl
vec2 warped = threeLayerWarp(p, time);
float regions = noise(warped * 2.0) * 0.5 + 0.5;
```

---

## Performance Considerations

Each warp layer requires 2 noise evaluations (x and y components). A 3-layer cascade needs minimum 6 noise calls per pixel.

Optimizations:
- **Texture-based noise**: Pre-compute noise into a texture, sample with hardware filtering
- **Reduce octaves at distance**: Distant pixels don't need fine detail
- **Temporal coherence**: Results change slowly, potential for temporal reprojection
- **Half precision**: Mobile GPUs benefit from `mediump` where visible precision isn't critical

---

## The Glossy Effect

Domain warping creates beautiful organic shapes, but to achieve a truly **glossy, luxurious** appearance, you need additional techniques layered on top.

### Caustic Highlights

Caustics simulate light refracting through a liquid or glass surface - those shimmering bright spots you see in swimming pools or through crystal.

```glsl
// Sample noise from warped domain for caustic pattern
float caustics = snoise(warpedPos * 3.0 + vec2(t * 0.1, t * 0.13));

// Threshold and soften - only keep the bright peaks
caustics = smoothstep(0.1, 0.7, caustics) * intensity * 0.5;

// Add to final color as bright highlights
finalColor += accentColor * caustics * 0.4;
```

The `smoothstep(0.1, 0.7, caustics)` creates sharp-ish highlights rather than smooth gradients. Multiplying by `intensity` ensures caustics only appear in lit areas.

### Warp Modulation (Intensity Variation)

Instead of uniform brightness across the glow, use the warped domain to modulate intensity itself:

```glsl
// Base symmetrical falloff from original coordinates
float baseIntensity = smoothstep(outerRadius, innerRadius, dist);

// Modulation from warped domain - creates paint-like variation
float warpModulation = snoise(warpedPos * 1.5) * 0.3 + 0.85;

// Combined - symmetrical shape with organic brightness variation
float intensity = baseIntensity * warpModulation;
```

This creates the effect of light catching different parts of a glossy surface differently - some areas brighter, some darker, but the overall shape remains centered.

### Multi-Accent Color Mixing

A single glow color looks flat. Rich, glossy surfaces shift between multiple related colors:

```glsl
// Three accent colors in the same family (e.g., orange to gold to cream)
uniform vec3 uAccent1;  // Primary: deep orange
uniform vec3 uAccent2;  // Secondary: bright orange
uniform vec3 uAccent3;  // Tertiary: golden cream

// Mix based on warped noise
float colorNoise = snoise(warpedPos * 2.0 + vec2(1.5, 3.2)) * 0.5 + 0.5;
vec3 warmGlow = mix(uAccent1, mix(uAccent2, uAccent3, colorNoise), colorNoise * 0.7);
```

The nested `mix()` creates smooth transitions between all three colors, driven by the warped domain for organic variation.

### Responsive Borders

If your effect involves discrete shapes (tiles, cells, etc.), make their borders respond to the lighting:

```glsl
float borderIntensity = intensity + caustics;

// Border color varies: darker in shadows, brighter in highlights
vec3 borderColor = mix(baseColor * 0.5, baseColor * 1.2, borderIntensity);

// Add subtle glow to bright borders
borderColor += accentColor * borderIntensity * 0.1;

// Blend based on distance to edge
finalColor = mix(borderColor, fillColor, smoothstep(0.0, borderWidth, edgeDist));
```

This creates a faceted, gem-like quality where edges catch light differently.

### Combining It All

The full glossy effect layer order:

```glsl
// 1. Domain warp the coordinates (3-layer cascade)
vec2 warpedPos = domainWarp(originalPos, time);

// 2. Base intensity from ORIGINAL coordinates (symmetry)
float baseIntensity = smoothstep(outer, inner, length(originalPos));

// 3. Organic regions from WARPED coordinates
float regions = snoise(warpedPos * 2.0) * 0.5 + 0.5;

// 4. Warp modulation for intensity variation
float warpMod = snoise(warpedPos * 1.5) * 0.3 + 0.85;

// 5. Combined intensity
float intensity = baseIntensity * (0.5 + regions * 0.5) * warpMod;

// 6. Caustic highlights
float caustics = smoothstep(0.1, 0.7, snoise(warpedPos * 3.0 + timeOffset)) * intensity;

// 7. Multi-accent color
vec3 glow = threeColorMix(accents, snoise(warpedPos * 2.0));

// 8. Build final color
vec3 color = mix(baseColor, liftedColor, intensity * 0.7);
color += glow * intensity * 0.35;      // Warm glow
color += glow * caustics * 0.4;        // Caustic highlights

// 9. Responsive borders (if applicable)
color = applyBorders(color, glow, intensity + caustics, edgeDist);
```

---

## Further Reading

- Inigo Quilez's articles on domain warping: https://iquilezles.org/articles/warp/
- "Painting with Math" - IQ's exploration of procedural art
- Simplex noise paper by Ken Perlin for understanding the underlying noise functions
