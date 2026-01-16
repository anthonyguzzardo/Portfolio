// Triangles Theme Fragment Shader
// Triangular mesh tessellation

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
uniform float u_tileSize;
uniform vec2 u_mouse;
varying vec2 vUv;

const float SQRT3 = 1.732050808;

// Distance to nearest line in a family of parallel lines
float distToLineFamily(vec2 p, vec2 dir, float spacing) {
  float proj = dot(p, vec2(-dir.y, dir.x));
  return abs(mod(proj + spacing * 0.5, spacing) - spacing * 0.5);
}

void main() {
  vec2 pixel = vUv * u_resolution;

  // Mouse lift effect - push pixels away from mouse
  vec2 toMouse = pixel - u_mouse;
  float mouseDist = length(toMouse);
  float mouseRadius = 200.0;
  float mouseInfluence = smoothstep(mouseRadius, 0.0, mouseDist);

  // Warp pixels outward from mouse (lift effect)
  vec2 warpedPixel = pixel + normalize(toMouse + 0.001) * mouseInfluence * 50.0;

  // Triangle size from uniform
  float size = u_tileSize;
  float triHeight = size * SQRT3 * 0.5;

  // Three families of parallel lines at 60° angles
  vec2 dir1 = vec2(1.0, 0.0);              // horizontal
  vec2 dir2 = vec2(0.5, SQRT3 * 0.5);      // 60°
  vec2 dir3 = vec2(-0.5, SQRT3 * 0.5);     // 120°

  float spacing = triHeight;

  float d1 = distToLineFamily(warpedPixel, dir1, spacing);
  float d2 = distToLineFamily(warpedPixel, dir2, spacing);
  float d3 = distToLineFamily(warpedPixel, dir3, spacing);

  float edgeDist = min(d1, min(d2, d3));

  // Charcoal rock surface
  vec3 charcoal = vec3(0.08, 0.07, 0.06);

  // Lava border colors - hot core to cooler edge
  vec3 lavaHot = vec3(1.0, 0.9, 0.2);    // bright yellow-white
  vec3 lavaMid = vec3(1.0, 0.4, 0.0);    // orange
  vec3 lavaCool = vec3(0.6, 0.1, 0.0);   // deep red

  // Lava glow width
  float glowWidth = 8.0;
  float coreWidth = 1.5;

  // Normalized distance for color gradient
  float t = clamp(edgeDist / glowWidth, 0.0, 1.0);

  // Lava color gradient: hot core -> orange -> red -> charcoal
  vec3 lavaColor = mix(lavaHot, lavaMid, smoothstep(0.0, 0.3, t));
  lavaColor = mix(lavaColor, lavaCool, smoothstep(0.2, 0.6, t));
  lavaColor = mix(lavaColor, charcoal, smoothstep(0.4, 1.0, t));

  // Add subtle pulsing glow
  float pulse = sin(u_time * 2.0) * 0.1 + 0.9;
  lavaColor *= mix(1.0, pulse, 1.0 - t);

  gl_FragColor = vec4(lavaColor, u_opacity);
}
`;
