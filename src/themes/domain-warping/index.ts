// Domain Warping Theme Export

import type { Theme } from '../types';
import { config } from './config';
import { colors } from './colors';
import { vertexShader, fragmentShader } from './shaders';

export const domainWarpingTheme: Theme = {
  config,
  colors,
  shaders: {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      u_time: { value: 0, type: 'float' },
      u_resolution: { value: [1920, 1080], type: 'vec2' }, // Set at runtime by ThemeBackground
      u_opacity: { value: 1.0, type: 'float' },
    },
  },
};

export default domainWarpingTheme;
