// Shared GLSL code exports
// Import these into theme shaders

export * from './noise.glsl';
export * from './warp.glsl';

// Common vertex shader (most themes use this)
export const basicVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Standard uniforms declaration
export const standardUniforms = `
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_opacity;
varying vec2 vUv;
`;
