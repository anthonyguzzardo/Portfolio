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
      u_resolution: { value: [1920, 1080], type: 'vec2' },
      u_opacity: { value: 1.0, type: 'float' },
      u_colorTheme: { value: 0, type: 'float' }, // 0=Neon, 1=Ocean, 2=Ember, 3=Aurora, 4=Void
    },
  },
};

export default domainWarpingTheme;
