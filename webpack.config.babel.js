import webpack from 'webpack';
import path from 'path';

const env = process.env.NODE_ENV;

export default {
  entry: [
    './src/index'
  ],

  output: {
    path: path.join(__dirname, 'dist'),
    filename: `redux-deep-diff${env === 'production' ? '.min' : ''}.js`,
    library: 'ReduxDeepDiff',
    libraryTarget: 'umd'
  },

  module: {
    rules: [{
      test: /\.js$/,
      use: ['babel-loader'],
      exclude: /node_modules/
    }]
  },

  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    (env === 'production' && (
      new webpack.optimize.UglifyJsPlugin({
        compressor: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          screw_ie8: true,
          warnings: false
        }
      })
    ))
  ].filter(Boolean)
};
