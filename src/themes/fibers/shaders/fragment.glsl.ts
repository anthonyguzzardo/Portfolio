// Fibers Theme Fragment Shader
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

  // Three families of parallel lines at 60° angles (rotated 90°)
  vec2 dir1 = vec2(0.0, 1.0);              // vertical
  vec2 dir2 = vec2(-SQRT3 * 0.5, 0.5);     // 150°
  vec2 dir3 = vec2(-SQRT3 * 0.5, -0.5);    // 210°

  float spacing = triHeight;

  // Center the coordinate system so scaling happens from screen center
  vec2 centeredPixel = warpedPixel - u_resolution * 0.5;

  // Vertical lines spaced further apart to create gaps between triangle columns
  float d1 = distToLineFamily(centeredPixel, dir1, spacing * 3.0);
  float d2 = distToLineFamily(centeredPixel, dir2, spacing);
  float d3 = distToLineFamily(centeredPixel, dir3, spacing);

  float edgeDist = min(d1, min(d2, d3));

  // Background color
  vec3 background = vec3(0.08, 0.07, 0.06);

  // Solid white border
  vec3 borderColor = vec3(1.0);

  // Line width
  float lineWidth = 1.5;

  // Sharp edge for solid line
  float line = 1.0 - smoothstep(0.0, lineWidth, edgeDist);

  vec3 finalColor = mix(background, borderColor, line);

  gl_FragColor = vec4(finalColor, u_opacity);
}
`;
