import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const light = {
  bg: "#F6F9F7",
  surface: "#FFFFFF",
  ink: "#102B50",
  muted: "#526174",
  green: "#1B5E20",
  amber: "#975000",
  border: "#CCD5D3",
  danger: "#B42318",
};
const dark = {
  bg: "#0B131B",
  surface: "#13202D",
  ink: "#F0F4F8",
  muted: "#B8C8D7",
  green: "#80D885",
  amber: "#FFD740",
  border: "#3A5061",
  danger: "#FF9090",
};
type Mode = "system" | "light" | "dark";
const Context = createContext({
  colors: light,
  mode: "system" as Mode,
  setMode: (_mode: Mode) => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    void AsyncStorage.getItem("cg.theme").then((v) => {
      if (v === "light" || v === "dark") setMode(v);
    });
  }, []);
  return (
    <Context.Provider
      value={{
        colors: (mode === "system" ? system : mode) === "dark" ? dark : light,
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
