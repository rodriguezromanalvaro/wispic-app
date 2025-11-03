module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          // Use only the meta-package to avoid multiple instances
          components: ['tamagui'],
          config: './tamagui.config.ts',
          platform: 'native',
          disableExtraction: true,
        },
      ],
      // NOTE: reanimated plugin must be last
      'react-native-reanimated/plugin',
    ],
  };
};
