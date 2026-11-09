import React from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";
import { AuthProvider } from "../src/auth/AuthContext";
import { ThemeProvider } from "../src/theme";
import { queryClient } from "../src/queries/client";
export default function Root() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Outfit_600SemiBold,
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
  return <Stack screenOptions={{ headerShown: false }} />;
}
