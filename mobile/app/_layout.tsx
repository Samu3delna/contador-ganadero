import React from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/AuthContext";
import { ThemeProvider, useTheme } from "../src/theme";
import { queryClient } from "../src/queries/client";
export default function Root() {
  const [loaded, error] = useFonts({
    BricolageSemiBold: require("../assets/fonts/BricolageSemiBold.ttf"),
    SourceSansRegular: require("../assets/fonts/SourceSansRegular.ttf"),
    SourceSansSemiBold: require("../assets/fonts/SourceSansSemiBold.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Navigation />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
function Navigation() {
  const { colors: c, isDark, reduceMotion } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen
          name="movimiento"
          options={{
            animation: reduceMotion ? "fade" : "slide_from_bottom",
            animationDuration: 250,
          }}
        />
      </Stack>
    </>
  );
}
