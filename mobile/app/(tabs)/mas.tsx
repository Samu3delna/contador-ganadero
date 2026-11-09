import React from "react";
import { router } from "expo-router";
import { Screen, Row } from "../../src/components/ui";
export default function More() {
  return (
    <Screen title="Más">
      <Row
        title="Impuestos y declaraciones"
        onPress={() => router.push("/impuestos")}
      />
      <Row
        title="Ingresos registrados"
        onPress={() => router.push("/ingresos")}
      />
      <Row
        title="Registrar gasto o ingreso"
        onPress={() => router.push("/movimiento")}
      />
      <Row title="Perfil y plan" onPress={() => router.push("/perfil")} />
    </Screen>
  );
}
