module.exports = {
  preset: "jest-expo",
  testMatch: ["**/tests/**/*.test.ts?(x)"],
  transformIgnorePatterns: [
    "/node_modules/(?!(\\.bun|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation))",
  ],
  testPathIgnorePatterns: ["/node_modules/"],
  modulePathIgnorePatterns: ["<rootDir>/.expo/"],
};
