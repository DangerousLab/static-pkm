import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'javascript/app.js',
  output: {
    file: 'javascript/app.min.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    terser({
      compress: {
        drop_console: ['log', 'debug'],
      },
      format: {
        comments: false,
      },
    }),
  ],
};
