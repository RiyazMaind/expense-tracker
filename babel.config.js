module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // React Compiler is enabled globally via `experiments.reactCompiler`
          // in app.json. These options are passed straight through to
          // babel-plugin-react-compiler.
          'react-compiler': {
            // Keep dev-time memo-cache validation; never abort a production
            // bundle on a compiler bailout.
            panicThreshold: 'all_errors',
          },
        },
      ],
    ],
  };
};