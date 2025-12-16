module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@hooks': './src/hooks',
          '@services': './src/services',
          '@store': './src/store',
          '@navigation': './src/navigation',
          '@utils': './src/utils',
          '@assets': './assets',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
