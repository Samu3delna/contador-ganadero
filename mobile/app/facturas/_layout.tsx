import React from "react";
import { Stack } from "expo-router";
import { SessionGate } from "../../src/components/SessionGate";
export default function Layout() {
  return (
    <SessionGate>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionGate>
  );
}
