import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';

export default {
  input: './src/index',
  output: {
    file: './dist/redux-deep-diff.js',
    format: 'umd',
    exports: 'named',
    name: 'ReduxDeepDiff'
  },
  plugins: [
    resolve(),
    commonjs({
      include: 'node_modules/**'
    }),
    babel({
      comments: false,
      minified: true,
      presets: [
        ['@babel/preset-env', {
          modules: false
        }],
        '@babel/preset-stage-2'
      ]
    })
  ]
};
