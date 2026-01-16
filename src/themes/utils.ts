// Theme runtime utilities

import type { Theme, ThemeColors, ShaderColors, RGB } from './types';
import { CSS_VAR_PREFIX, THEME_STORAGE_KEY, hexToRgb } from './constants';

/**
 * Apply theme colors as CSS custom properties to :root
 */
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = `${CSS_VAR_PREFIX}${camelToKebab(key)}`;
    root.style.setProperty(cssVar, value);
  });
}

/**
 * Apply theme styles (optional CSS overrides)
 */
export function applyThemeStyles(styles: string | undefined, themeId: string): void {
  // Remove existing theme style element
  const existingStyle = document.getElementById('theme-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  if (!styles) return;

  // Create and inject new style element
  const styleEl = document.createElement('style');
  styleEl.id = 'theme-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

/**
 * Set dark mode class on document
 */
export function setDarkMode(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Save theme ID to localStorage
 */
export function saveThemePreference(themeId: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Load theme ID from localStorage
 */
export function loadThemePreference(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Convert ThemeColors to ShaderColors (hex strings to RGB 0-1 tuples)
 */
export function themeColorsToShaderColors(colors: ThemeColors): ShaderColors {
  return {
    base: hexToRgb(colors.background),
    lifted: hexToRgb(colors.surface),
    accent1: hexToRgb(colors.accent),
    accent2: hexToRgb(colors.accentHover),
    accent3: hexToRgb(colors.accentMuted),
  };
}

/**
 * Dispatch theme change event for WebGL components
 */
export function dispatchThemeChange(theme: Theme): void {
  const shaderColors = themeColorsToShaderColors(theme.colors);

  window.dispatchEvent(
    new CustomEvent('theme:change', {
      detail: {
        themeId: theme.config.id,
        colors: shaderColors,
        isDark: theme.config.isDark,
      },
    })
  );
}

/**
 * Apply a complete theme
 */
export function applyTheme(theme: Theme): void {
  applyThemeColors(theme.colors);
  applyThemeStyles(theme.styles, theme.config.id);
  setDarkMode(theme.config.isDark);
  saveThemePreference(theme.config.id);
  dispatchThemeChange(theme);

  // Set theme ID on document for CSS selectors
  document.documentElement.dataset.theme = theme.config.id;
}

/**
 * Utility: Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Smoothstep function (GLSL equivalent)
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Mix/blend two RGB colors
 */
export function mixColors(a: RGB, b: RGB, t: number): RGB {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}
