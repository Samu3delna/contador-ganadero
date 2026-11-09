import React from "react";
import { router } from "expo-router";
import { Screen, Row } from "../../src/components/ui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
export default function More() {
  const { colors: c } = useTheme();
  return (
    <Screen title="Tu espacio">
      <Row
        title="Impuestos y declaraciones"
        subtitle="Un resumen para conversar con tu contador"
        icon={<Feather name="file-text" size={21} color={c.green} />}
        onPress={() => router.push("/impuestos")}
      />
      <Row
        title="Ingresos registrados"
        subtitle="Lo que produce tu trabajo"
        icon={<Feather name="bar-chart-2" size={21} color={c.green} />}
        onPress={() => router.push("/ingresos")}
      />
      <Row
        title="Registrar gasto o ingreso"
        icon={<Feather name="plus" size={21} color={c.green} />}
        onPress={() => router.push("/movimiento")}
      />
      <Row
        title="Perfil y plan"
        subtitle="Tu finca, preferencias y sesión"
        icon={<Feather name="user" size={21} color={c.green} />}
        onPress={() => router.push("/perfil")}
      />
    </Screen>
  );
}
