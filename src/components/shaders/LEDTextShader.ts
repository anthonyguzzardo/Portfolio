// LEDTextShader.ts - LED pixelation effect for carousel text
// Dark theme: includes gravitational lensing toward black hole
// Light theme: NO distortion, clean LED dots

export const ledTextVertexShader = `
  varying vec2 vUv;
  varying vec2 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xy;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const ledTextFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uScreenWidth;
  uniform vec2 uTextureSize;
  uniform float uPixelSize;
  uniform float uHover;
  uniform float uIsLightTheme;
  uniform float uBlackHoleRadius;
  uniform float uAccretionRadius;
  varying vec2 vUv;
  varying vec2 vWorldPos;

  void main() {
    // === LIGHT THEME: NO DISTORTION ===
    vec2 lensedUV = vUv;
    float gravity = 0.0;

    if (uIsLightTheme < 0.5) {
      // === DARK THEME: BLACK HOLE EFFECTS ===
      float dist = length(vWorldPos);
      gravity = smoothstep(uAccretionRadius, uBlackHoleRadius, dist);

      // === EVENT HORIZON - absolute black, early exit ===
      if (dist < uBlackHoleRadius * 0.8) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }

      // === RADIAL LENSING (UV space only) ===
      vec2 toCenter = -normalize(vWorldPos + 0.0001);
      float lensStrength = gravity * 0.15;
      lensedUV = vUv + toCenter * lensStrength * (1.0 - vUv.x);
      lensedUV = clamp(lensedUV, 0.0, 1.0);
    }

    // Sample texture directly (solid rendering)
    vec4 texColor = texture2D(uTexture, lensedUV);
    vec3 baseColor = texColor.rgb;
    float baseAlpha = texColor.a;

    // Warm tint based on gravity (only in dark theme)
    if (uIsLightTheme < 0.5) {
      vec3 warmTint = vec3(1.0, 0.85, 0.7);
      baseColor = mix(baseColor, warmTint, gravity * 0.5);
      baseColor *= 1.0 + gravity * 1.3;
    }

    // === LED DOT EFFECT (only on hover) ===
    float dotAlpha = 1.0;
    if (uHover > 0.01) {
      vec2 texelSize = vec2(1.0) / uTextureSize;
      float pixelSize = uPixelSize;
      vec2 gridScale = texelSize * pixelSize;
      vec2 gridPos = lensedUV / gridScale;
      vec2 localPos = fract(gridPos);
      float dotDist = length(localPos - 0.5);

      float dotRadius = mix(0.38, 0.48, uIsLightTheme);
      float dotSoftness = mix(0.15, 0.18, uIsLightTheme);
      float dot = 1.0 - smoothstep(dotRadius - dotSoftness, dotRadius + dotSoftness * 0.5, dotDist);

      // Blend between solid (1.0) and LED dots based on hover
      dotAlpha = mix(1.0, dot, uHover);
    }

    // === FINAL COLOR ===
    vec4 color = vec4(baseColor, baseAlpha * dotAlpha);

    // Hover color effect
    if (uIsLightTheme > 0.5) {
      color.rgb = mix(color.rgb, vec3(0.9, 0.4, 0.1), uHover * 0.5);
    } else {
      color.rgb *= 1.0 + uHover * 1.2;
      color.rgb = mix(color.rgb, vec3(1.0, 0.95, 0.8), uHover * 0.3);
    }

    // Vertical fade at edges
    float edgeFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    color.a *= edgeFade;

    gl_FragColor = color;
  }
`;
