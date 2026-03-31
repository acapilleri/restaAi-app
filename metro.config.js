const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Reanimated declares `"react-native": "src/index"`, which makes Metro bundle TypeScript
 * sources. Some setups fail to resolve `./layoutReanimation` from that entry; forcing the
 * prebuilt `lib/module` entry avoids missing subpath resolution.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const base = getDefaultConfig(__dirname);

const config = mergeConfig(base, {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react-native-reanimated') {
        return {
          filePath: require.resolve('react-native-reanimated/lib/module/index.js'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
});

module.exports = wrapWithReanimatedMetroConfig(config);
