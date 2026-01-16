// Domain Warping Theme Colors
// Based on flowGradientColors.md palette - NO BLACKS

import type { ThemeColors, ShaderColors } from '../types';
import { hexToRgb } from '../constants';

/**
 * Palette from flowGradientColors.md:
 * #bf479b (magenta)     #1f391e (deep green)   #c991cc (lavender)
 * #972f52 (burgundy)    #461f1d (dark brown)   #6b3038 (dark red)
 * #2d449d (royal blue)  #c9769b (pink)         #7c59b0 (purple)
 * #154a38 (dark teal)
 *
 * NO BLACKS - deepest colors are rich greens/teals/browns
 */

// CSS custom property values
export const colors: ThemeColors = {
  // Backgrounds - deep rich colors, NOT black
  background: '#1f391e', // Deep green (primary anchor)
  backgroundAlt: '#154a38', // Deep teal

  // Surfaces - warm browns/wines
  surface: '#461f1d', // Dark brown
  surfaceHover: '#6b3038', // Dark wine

  // Text - light for dark theme
  text: '#f5f0f2', // Off-white with pink tint
  textMuted: '#c991cc', // Lavender
  textInverse: '#1f391e', // Deep green (not black)

  // Accents - the saturated mids
  accent: '#bf479b', // Magenta (primary)
  accentHover: '#c9769b', // Pink (lighter)
  accentMuted: '#7c59b0', // Purple

  // Borders
  border: '#6b3038', // Dark wine
  borderMuted: '#461f1d', // Dark brown
};

// Shader-specific colors (RGB 0-1 range)
export const shaderColors: ShaderColors = {
  base: hexToRgb('#1f391e'), // Deep green (not black)
  lifted: hexToRgb('#154a38'), // Deep teal
  accent1: hexToRgb('#bf479b'), // Magenta
  accent2: hexToRgb('#7c59b0'), // Purple
  accent3: hexToRgb('#2d449d'), // Royal blue
};

// Extended palette for shader color mixing
export const extendedShaderPalette = {
  // Darks (anchors/grounding) - rich colors, NOT black
  deepGreen: hexToRgb('#1f391e'),
  deepTeal: hexToRgb('#154a38'),
  darkBrown: hexToRgb('#461f1d'),
  darkWine: hexToRgb('#6b3038'),

  // Saturated mids (the color)
  magenta: hexToRgb('#bf479b'),
  burgundy: hexToRgb('#972f52'),
  royalBlue: hexToRgb('#2d449d'),
  purple: hexToRgb('#7c59b0'),

  // Luminous (highlights)
  pink: hexToRgb('#c9769b'),
  lavender: hexToRgb('#c991cc'),
};
