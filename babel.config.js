module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['@tamagui/core', '@tamagui/stacks', '@tamagui/text', '@tamagui/button'],
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
