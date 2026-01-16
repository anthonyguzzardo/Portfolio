// Theme system type definitions

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundAlt: string;

  // Surface colors
  surface: string;
  surfaceHover: string;

  // Text colors
  text: string;
  textMuted: string;
  textInverse: string;

  // Accent colors
  accent: string;
  accentHover: string;
  accentMuted: string;

  // Border colors
  border: string;
  borderMuted: string;
}

export interface ShaderUniforms {
  [key: string]: {
    value: number | number[] | Float32Array;
    type?: 'float' | 'vec2' | 'vec3' | 'vec4';
  };
}

export interface ThemeShaders {
  vertex: string;
  fragment: string;
  uniforms?: ShaderUniforms;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  previewColor: string; // Color shown in theme picker
  isDark: boolean;
}

export interface Theme {
  config: ThemeConfig;
  colors: ThemeColors;
  shaders?: ThemeShaders;
  styles?: string; // Optional CSS overrides
}

// RGB tuple for shader uniforms (0-1 range)
export type RGB = [number, number, number];

// Shader color set for WebGL
export interface ShaderColors {
  base: RGB;
  lifted: RGB;
  accent1: RGB;
  accent2: RGB;
  accent3: RGB;
}
