// Lego Theme Fragment Shader
// Renders a tiled lego brick surface seen from above. Each cell hosts a
// circular stud with a soft upper-left highlight; the brick between studs
// catches a subtle drop shadow on its lower-right side. Static — the goal
// is "feels like a brick wall behind the page", not a busy animation.

export const fragmentShader = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_opacity;
uniform float u_time;
varying vec2  vUv;

void main() {
  vec2 fragCoord = vUv * u_resolution;

  // Tile the screen into stud cells. Cell size in pixels — ~80 reads as
  // chunky lego baseplate at typical desktop sizes.
  float cellSize = 80.0;
  vec2 cellUv = fract(fragCoord / cellSize) - 0.5;   // [-0.5, 0.5]
  float dist  = length(cellUv);

  float studRadius = 0.31;                           // ~62% of cell
  float stud = 1.0 - smoothstep(studRadius - 0.005, studRadius + 0.005, dist);

  // Lego blue brick + lighter stud face.
  vec3 brick    = vec3(0.173, 0.435, 0.651);         // #2c6fa6
  vec3 studBase = vec3(0.310, 0.580, 0.804);         // #4f94cd
  vec3 studHi   = vec3(0.596, 0.788, 0.929);         // #98c9ed

  // Stud lighting — bright spot in the upper-left of each stud.
  float hlDist  = length(cellUv - vec2(-0.10, -0.10));
  float hl      = 1.0 - smoothstep(0.0, 0.22, hlDist);
  vec3  studCol = mix(studBase, studHi, hl * stud * 0.85);

  // Drop shadow on the brick surface (offset to lower-right; only matters
  // outside the stud disc).
  vec2  shadowOffset = vec2(0.04, 0.08);
  float shadowDist   = length(cellUv - shadowOffset);
  float shadowFactor = (1.0 - smoothstep(studRadius - 0.02, studRadius + 0.10, shadowDist))
                       * (1.0 - stud);
  vec3  brickShaded  = mix(brick, brick * 0.55, shadowFactor * 0.55);

  vec3 color = mix(brickShaded, studCol, stud);

  // Subtle overall vignette so the edges don't feel tiled-flat.
  vec2 ndc = (vUv - 0.5) * 2.0;
  color *= 1.0 - dot(ndc, ndc) * 0.12;

  gl_FragColor = vec4(color, u_opacity);
}
`;
