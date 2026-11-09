import React, { createContext, useContext, useEffect, useState } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const light = {
  bg: "#FFF8EB",
  surface: "#FFFDF7",
  ink: "#292E20",
  muted: "#61684E",
  green: "#435528",
  amber: "#8C4C20",
  border: "#DEDAC8",
  danger: "#9B432D",
  soft: "#EEEACB",
  onGreen: "#FFF8EB",
};
const dark = {
  bg: "#252B1C",
  surface: "#323A28",
  ink: "#FFF8E9",
  muted: "#D0D4BC",
  green: "#D4DFA4",
  amber: "#F0C899",
  border: "#626C4C",
  danger: "#FFB5A3",
  soft: "#3C452A",
  onGreen: "#262E16",
};
export const fonts = {
  heading: "BricolageSemiBold",
  body: "SourceSansRegular",
  strong: "SourceSansSemiBold",
} as const;
type Mode = "system" | "light" | "dark";
const Context = createContext({
  colors: light,
  mode: "system" as Mode,
  setMode: (_mode: Mode) => {},
  reduceMotion: true,
  isDark: false,
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<Mode>("system");
  const [reduceMotion, setReduceMotion] = useState(true);
  const isDark = (mode === "system" ? system : mode) === "dark";
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setReduceMotion(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted && !changed) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    void AsyncStorage.getItem("cg.theme").then((v) => {
      if (v === "light" || v === "dark") setMode(v);
    });
  }, []);
  return (
    <Context.Provider
      value={{
        colors: isDark ? dark : light,
        reduceMotion,
        isDark,
        mode,
        setMode: (value) => {
          setMode(value);
          void AsyncStorage.setItem("cg.theme", value);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
