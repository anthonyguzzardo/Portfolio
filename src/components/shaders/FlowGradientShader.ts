// FlowGradientShader.ts - Organic flow effect for light theme

export const flowGradientVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const flowGradientFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_opacity;
  varying vec2 vUv;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                    + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // FBM noise for smoother flow
  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 4; i++) {
      f += amp * snoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float t = u_time * 0.08;

    // Flow field distortion
    vec2 flowUV = uv * 1.5;
    float nx = fbm(flowUV + vec2(t * 0.8, t * 0.2));
    float ny = fbm(flowUV + vec2(t * 0.25, t * 0.7) + 100.0);
    vec2 flow = vec2(nx, ny) * 0.17;
    vec2 distortedUV = uv + flow;

    // DARKS (anchors/grounding)
    vec3 nearBlack = vec3(0.03, 0.02, 0.05);
    vec3 deepGreen = vec3(0.04, 0.08, 0.05);
    vec3 deepTeal = vec3(0.03, 0.10, 0.08);

    // SATURATED MIDS (the color)
    vec3 magenta = vec3(0.75, 0.28, 0.61);
    vec3 raspberry = vec3(0.59, 0.18, 0.32);
    vec3 royalBlue = vec3(0.18, 0.27, 0.62);
    vec3 purple = vec3(0.49, 0.35, 0.69);

    // LUMINOUS (highlights)
    vec3 hotPink = vec3(0.95, 0.45, 0.75);
    vec3 lightPink = vec3(0.85, 0.65, 0.85);

    // Large scale flow
    float n1 = snoise(distortedUV * 0.8 + t * 0.15);
    float n2 = snoise(distortedUV * 0.9 + vec2(50.0, 0.0) - t * 0.12);
    float n3 = snoise(distortedUV * 0.7 + vec2(0.0, 80.0) + t * 0.1);

    // High frequency for border ripples
    float ripple = snoise(distortedUV * 6.0 + t * 0.3) * 0.08;

    // Start with deep dark base
    vec3 color = nearBlack;

    // Large color regions with SHARP transitions
    color = mix(color, deepGreen, smoothstep(-0.05 + ripple, 0.05 + ripple, n1));
    color = mix(color, magenta, smoothstep(0.1 + ripple, 0.2 + ripple, n1));
    color = mix(color, deepTeal, smoothstep(-0.1 + ripple, 0.0 + ripple, n2));
    color = mix(color, royalBlue, smoothstep(0.15 + ripple, 0.25 + ripple, n2));
    color = mix(color, purple, smoothstep(0.0 + ripple, 0.1 + ripple, n3));
    color = mix(color, raspberry, smoothstep(0.2 + ripple, 0.3 + ripple, n1 + n3 * 0.5));

    // Luminous highlights - rare and bright
    color = mix(color, hotPink, smoothstep(0.5, 0.6, n1 * n2) * 0.7);
    color = mix(color, lightPink, smoothstep(0.55, 0.65, n2 * n3) * 0.5);

    vec3 softColor = color;

    // Film grain
    float grain = fract(sin(dot(vUv * u_resolution + u_time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
    grain = (grain - 0.5) * 0.04;
    softColor += grain;

    // Edge fade
    float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);

    gl_FragColor = vec4(softColor, edgeFade * 0.9 * u_opacity);
  }
`;
