import postcss from 'rollup-plugin-postcss';

export default {
  input: 'css/main.css',
  output: {
    file: 'css/app.min.css',
  },
  plugins: [
    postcss({
      extract: true,
      minimize: true,
      sourceMap: true,
      extensions: ['.css'],
    }),
  ],
};
