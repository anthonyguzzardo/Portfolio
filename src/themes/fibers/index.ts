// fibers Theme Export

import type { Theme } from '../types';
import { config } from './config';
import { colors } from './colors';
import { vertexShader, fragmentShader } from './shaders';

export const fibersTheme: Theme = {
  config,
  colors,
  shaders: {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      u_time: { value: 0, type: 'float' },
      u_resolution: { value: [1920, 1080], type: 'vec2' },
      u_opacity: { value: 1.0, type: 'float' },

      // Fiber parameters
      u_scale: { value: 1.0, type: 'float' },
      u_radius: { value: 0.018, type: 'float' },
      u_sharpness: { value: 8.0, type: 'float' },
      u_length: { value: 0.8, type: 'float' },
      u_texture: { value: 0.3, type: 'float' },
      u_angle: { value: 15.0, type: 'float' },
      u_curve: { value: 0.003, type: 'float' },
      u_bend: { value: 0.0, type: 'float' },
      u_kink: { value: 0.0, type: 'float' },

      // Lighting parameters
      u_lightAngle: { value: 45.0, type: 'float' },
      u_lightHeight: { value: 0.5, type: 'float' },
      u_specular: { value: 0.4, type: 'float' },
      u_glossiness: { value: 32.0, type: 'float' },
    },
  },
};

export default fibersTheme;
