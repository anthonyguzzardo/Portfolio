// Lego Theme Export
// No shader — the visual is a DOM-based stud grid (LegoBackground.astro)
// rendered only when this theme is active. The theme system just sets the
// brick-blue clear color underneath it.

import type { Theme } from '../types';
import { config } from './config';
import { colors } from './colors';

export const legoTheme: Theme = {
  config,
  colors,
};

export default legoTheme;
