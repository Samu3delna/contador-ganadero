import type { ExpoConfig } from "expo/config";
import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://contador-ganadero.onrender.com/api";
const app: ExpoConfig = {
  name: "ContadorGanadero",
  slug: "contador-ganadero-mobile",
  version: "0.1.1",
  scheme: "contadorganadero",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/logo.png",
  ios: {
    buildNumber: "2",
    supportsTablet: true,
    bundleIdentifier: "com.contadorganadero.mobile",
  },
  android: { package: "com.contadorganadero.mobile", versionCode: 2 },
  plugins: [
    "./plugins/withUnsignedRelease",
    "expo-router",
    "expo-secure-store",
    ["expo-sqlite", { useSQLCipher: true }],
    [
      "expo-local-authentication",
      { faceIDPermission: "Desbloquear los datos de tu finca." },
    ],
  ],
  extra: { apiUrl },
};
export default app;
