import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SessionGate } from "../../src/components/SessionGate";
import { fonts, useTheme } from "../../src/theme";
export default function Layout() {
  const { colors: c } = useTheme();
  return (
    <SessionGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.green,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
          tabBarLabelStyle: { fontFamily: fonts.strong, fontSize: 12 },
          tabBarItemStyle: { minHeight: 52, borderRadius: 18 },
          tabBarActiveBackgroundColor: c.soft,
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: c.bg },
        }}
      >
        {[
          ["index", "Inicio", "home"],
          ["facturas", "Facturas", "file-text"],
          ["inventario", "Inventario", "box"],
          ["mas", "Más", "more-horizontal"],
        ].map(([name, title, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ color, size }) => (
                <Feather
                  name={icon as "home"}
                  color={typeof color === "string" ? color : c.ink}
                  size={size}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </SessionGate>
  );
}
