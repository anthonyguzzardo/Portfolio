// Theme Registry
// Central export for all themes with getter/setter functions

import type { Theme } from './types';
import { DEFAULT_THEME_ID } from './constants';
import { applyTheme, loadThemePreference } from './utils';
import { domainWarpingTheme } from './domain-warping';
import { tennisTheme } from './tennis';

// Export types
export type { Theme, ThemeColors, ThemeConfig, ShaderColors, RGB } from './types';

// Export utilities
export { applyTheme, loadThemePreference, themeColorsToShaderColors } from './utils';
export { hexToRgb, rgbToHex } from './constants';

// Theme registry
const themes: Map<string, Theme> = new Map([
  ['domain-warping', domainWarpingTheme],
  ['tennis', tennisTheme],
]);

// All available themes (for dropdown population)
export const allThemes: Theme[] = Array.from(themes.values());

/**
 * Get a theme by ID
 */
export function getTheme(id: string): Theme | undefined {
  return themes.get(id);
}

/**
 * Get the default theme
 */
export function getDefaultTheme(): Theme {
  return themes.get(DEFAULT_THEME_ID) ?? domainWarpingTheme;
}

/**
 * Set and apply a theme by ID
 * Returns true if successful, false if theme not found
 */
export function setTheme(id: string): boolean {
  const theme = themes.get(id);
  if (!theme) return false;

  applyTheme(theme);
  return true;
}

/**
 * Initialize theme system
 * Loads saved preference or applies default
 */
export function initializeTheme(): Theme {
  const savedId = loadThemePreference();
  const theme = savedId ? getTheme(savedId) : undefined;
  const activeTheme = theme ?? getDefaultTheme();

  applyTheme(activeTheme);
  return activeTheme;
}

/**
 * Register a new theme at runtime
 */
export function registerTheme(theme: Theme): void {
  themes.set(theme.config.id, theme);
}

/**
 * Check if a theme exists
 */
export function hasTheme(id: string): boolean {
  return themes.has(id);
}

/**
 * Get all theme IDs
 */
export function getThemeIds(): string[] {
  return Array.from(themes.keys());
}
