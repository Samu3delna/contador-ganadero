import React from "react";
import { router } from "expo-router";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Label, Status } from "../../src/components/ui";
import { fonts, useTheme } from "../../src/theme";
import { useRemote } from "../../src/hooks/useRemote";
export default function Inventario() {
  const q = useRemote<Record<string, number>>("/inventario/resumen");
  const { colors: c } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <Screen title="Inventario de tu finca">
      <Label muted>Una finca, mucha vida. Consulta cada actividad.</Label>
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {[
          ["bovinos", "Bovinos", "totalBovinos", "box"],
          ["aves", "Aves", "totalAves", "feather"],
          ["peces", "Peces", "totalPeces", "droplet"],
          ["colmenas", "Abejas", "totalMiel", "hexagon"],
        ].map(([type, label, key, icon]) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => ({
              width: fontScale > 1.3 ? "100%" : "47%",
              flexGrow: 1,
              gap: 10,
              padding: 20,
              minHeight: 150,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: pressed ? c.soft : c.surface,
            })}
            onPress={() => router.push("/inventario/" + type)}
          >
            <Feather name={icon as "box"} size={25} color={c.green} />
            <Text
              style={{ fontFamily: fonts.heading, fontSize: 30, color: c.ink }}
            >
              {q.data ? String(q.data.data[key] || 0) : "—"}
            </Text>
            <Label>
              {label}
              {type === "colmenas" ? " · kg de miel" : " · animales"}
            </Label>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
