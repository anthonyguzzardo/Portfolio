// Shared constants across themes

// Default theme ID
export const DEFAULT_THEME_ID = 'domain-warping';

// LocalStorage key for persisting theme
export const THEME_STORAGE_KEY = 'portfolio-theme';

// Animation timing
export const TRANSITION_DURATION = 300; // ms

// Shader defaults
export const SHADER_DEFAULTS = {
  MAX_STEPS: 100,
  EPSILON: 0.001,
  MAX_DIST: 100.0,
} as const;

// Domain warping parameters
export const WARP_DEFAULTS = {
  // Layer 1: Large folds
  layer1: {
    frequency: 1.5,
    strength: 0.4,
  },
  // Layer 2: Medium compression
  layer2: {
    frequency: 2.5,
    strength: 0.25,
  },
  // Layer 3: Fine detail
  layer3: {
    frequency: 4.0,
    strength: 0.12,
  },
} as const;

// Decorrelation offsets (IQ standard)
export const DECORRELATION_OFFSETS = {
  offset1: [5.2, 1.3],
  offset2: [1.7, 9.2],
  offset3: [8.3, 2.8],
  offset4: [4.1, 3.7],
  offset5: [2.9, 7.1],
} as const;

// Prime-ratio animation frequencies (avoid visible repetition)
export const ANIMATION_FREQUENCIES = {
  slow: [0.07, 0.09, 0.11, 0.13],
  medium: [0.17, 0.19, 0.23, 0.29],
  fast: [0.31, 0.37, 0.41, 0.43],
} as const;

// CSS custom property prefix
export const CSS_VAR_PREFIX = '--theme-';

// Hex to RGB conversion (returns 0-1 range for shaders)
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

// RGB (0-1) to hex conversion
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
