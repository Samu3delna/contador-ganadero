// Local release builds are signed separately; never publish Expo's debug key.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withUnsignedRelease(config) {
  return withAppBuildGradle(config, (mod) => {
    const source = mod.modResults.contents;
    const release = /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    mod.modResults.contents = source.replace(release, "$1signingConfig null");
    return mod;
  });
};
