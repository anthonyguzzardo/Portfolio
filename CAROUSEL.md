# ProjectCarousel Component

A WebGL-powered infinite scrolling carousel with LED pixel effects and an animated central glow rift.

## Tech Stack

- **Three.js** - WebGL rendering library
- **GLSL Shaders** - Custom vertex and fragment shaders for LED pixelation effects
- **Astro** - Component framework (`.astro` file)
- **TypeScript** - Type-safe scripting

## Installation

```bash
npm install three
npm install -D @types/three  # Optional, for TypeScript support
```

## Architecture Overview

### Rendering Setup

The carousel uses Three.js with an **orthographic camera** for 2D-style rendering on a full-width canvas:

```typescript
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,      // Transparent background
  antialias: false, // Disabled for crisp pixel effect
});

const camera = new THREE.OrthographicCamera(
  -width / 2, width / 2,
  height / 2, -height / 2,
  -1000, 1000
);
```

### Text Rendering

Project names are rendered to offscreen canvas elements, then converted to Three.js textures:

```typescript
function createTextTexture(text: string, fontSize: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = colors.text;
  ctx.fillText(text, 20, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter; // Crisp pixels
  texture.magFilter = THREE.NearestFilter;

  return texture;
}
```

## Shader Effects

### LED Pixelation Shader

The fragment shader creates an LED dot matrix effect:

**Key uniforms:**
- `uTexture` - The text/image texture
- `uTime` - Animation time
- `uPixelSize` - Size of LED pixels
- `uHover` - Hover state (0.0 to 1.0)
- `uIsLightTheme` - Theme toggle (0.0 or 1.0)

**LED dot rendering:**
```glsl
vec2 pixelPos = fract(vUv / texelSize / pixelSize);
float dotDist = length(pixelPos - 0.5);
float dotRadius = 0.38;
float dot = 1.0 - smoothstep(dotRadius - dotSoftness, dotRadius, dotDist);
```

**Rift zone effects (center distortion):**
- Chromatic aberration
- Pixel scatter/jitter
- Orange/red color tinting
- Brightness boost

### Central Glow Effect

A separate mesh renders the animated "rift" glow using organic turbulence:

**Layered sine waves for plasma-like movement:**
```glsl
float turbulence = 0.0;
turbulence += sin(noiseCoord.x * 2.0 + uTime * 0.8) * sin(noiseCoord.y * 2.5 + uTime * 0.6) * 0.5;
turbulence += sin(noiseCoord.x * 4.0 - uTime * 1.1) * sin(noiseCoord.y * 3.5 + uTime * 0.9) * 0.25;
turbulence += sin(noiseCoord.x * 7.0 + uTime * 1.4) * sin(noiseCoord.y * 6.0 - uTime * 1.2) * 0.125;
```

**Blending modes:**
- Dark theme: `THREE.AdditiveBlending` (glowing effect)
- Light theme: `THREE.NormalBlending` (opaque colors)

## Theme Support

The carousel responds to theme changes via a MutationObserver watching `data-theme`:

```typescript
const observer = new MutationObserver(() => {
  const lightTheme = isLightTheme();

  projectMeshes.forEach((item) => {
    item.material.uniforms.uIsLightTheme.value = lightTheme ? 1.0 : 0.0;
    // Regenerate text textures with new colors...
  });

  // Update glow blending mode
  glowMaterial.blending = lightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
});
```

## Interaction Handling

### Hit Detection

Mouse position is converted to scene coordinates for accurate hover/click detection:

```typescript
function getItemAtPosition(clientX: number, clientY: number): ProjectMesh | null {
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left - rect.width / 2;
  const mouseY = (rect.height / 2) - (clientY - rect.top);

  for (const item of projectMeshes) {
    // Check X and Y bounds
    if (mouseX >= meshX - halfHitWidth && mouseX <= meshX + halfHitWidth &&
        mouseY >= meshY - halfHeight && mouseY <= meshY + halfHeight) {
      return item;
    }
  }
  return null;
}
```

### Hover Animation

Smooth interpolation for hover state:

```typescript
const targetHover = item === hoveredItem ? 1.0 : 0.0;
const currentHover = item.material.uniforms.uHover.value;
item.material.uniforms.uHover.value += (targetHover - currentHover) * 0.2;
```

## Infinite Scrolling

Items wrap around seamlessly using modulo arithmetic:

```typescript
let x = item.mesh.userData.baseX - scrollX;
x = ((x % wrapWidth) + wrapWidth) % wrapWidth;
x -= wrapWidth / 2;
item.mesh.position.x = x;
```

## CSS Structure

```css
.carousel-section {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: visible;
}

#carousel-canvas {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  height: 500%;  /* Extra height for glow effect */
  pointer-events: auto;
}
```

## Configuration

Key constants to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `fontSize` | `min(100, width * 0.1)` | Text size |
| `gap` | `120` | Space between items |
| `pixelSize` | `3.0` | LED pixel size |
| `scrollSpeed` | `1.2` | Animation speed |
| `glowWidth` | `500` | Central glow width |
| `glowHeight` | `min(height * 0.6, 600)` | Central glow height |

## Adding New Projects

Edit the `projects` array:

```typescript
const projects: Project[] = [
  { name: 'PROJECT NAME', link: 'https://example.com' },
  { name: 'IMAGE PROJECT', link: '/page', isImage: true, imagePath: '/images/logo.png' },
];
```

## Performance Notes

- `antialias: false` keeps pixels crisp and improves performance
- `pixelRatio` is capped at 2 to prevent excessive GPU load on high-DPI displays
- Textures use `NearestFilter` to avoid blur and reduce sampling cost
- Animation uses `requestAnimationFrame` with delta time for consistent speed
