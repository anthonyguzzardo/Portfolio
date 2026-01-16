// Tennis Theme Fragment Shader
// Grey sphere with lighting

export const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
varying vec2 vUv;

#define MAX_STEPS 64
#define MAX_DIST 100.0
#define EPSILON 0.001

// Sphere SDF
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Scene
float scene(vec3 p) {
  return sdSphere(p, 0.65);
}

// Normal via gradient
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(EPSILON, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

// Ray march
float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = scene(p);
    if (d < EPSILON) break;
    t += d;
    if (t > MAX_DIST) break;
  }
  return t;
}

void main() {
  // Aspect-corrected UV centered at origin
  vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  // Camera setup
  vec3 ro = vec3(0.0, 0.0, 3.0); // Camera position
  vec3 rd = normalize(vec3(uv, -1.0)); // Ray direction

  // March
  float t = rayMarch(ro, rd);

  // Background color (black)
  vec3 color = vec3(0.0);

  if (t < MAX_DIST) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    // Light from upper right
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(n, lightDir), 0.0);

    // Ambient + diffuse
    float ambient = 0.15;
    vec3 ballColor = vec3(0.8, 1.0, 0.0); // #CCFF00
    color = ballColor * (ambient + diff * 0.85);
  }

  gl_FragColor = vec4(color, u_opacity);
}
`;
