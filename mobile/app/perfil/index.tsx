import React, { useState } from "react";
import { Alert, Linking } from "react-native";
import { router } from "expo-router";
import { Screen, Row, Label, Button } from "../../src/components/ui";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme";
import { message } from "../../src/api/client";
export default function Profile() {
  const auth = useAuth();
  const theme = useTheme();
  const [error, setError] = useState("");
  return (
    <Screen title="Perfil y plan">
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Row title={auth.user?.nombre || ""} subtitle={auth.user?.email} />
      <Row
        title="Finca"
        right={auth.user?.nombreFinca || auth.user?.tenant?.nombreFinca}
      />
      <Row
        title="Plan"
        right={auth.user?.plan || auth.user?.tenant?.plan || "free"}
      />
      {(["system", "light", "dark"] as const).map((mode, i) => (
        <Button
          key={mode}
          title={
            ["Tema del teléfono", "Modo claro", "Modo oscuro"][i] +
            (theme.mode === mode ? " · seleccionado" : "")
          }
          secondary
          onPress={() => theme.setMode(mode)}
        />
      ))}
      <Label muted>
        La consulta offline requiere bloqueo seguro y se renueva al validar la
        sesión online. Caduca a los siete días.
      </Label>
      <Button
        title="Términos y condiciones"
        secondary
        onPress={() =>
          void Linking.openURL("https://contadorganadero.com/terminos")
        }
      />
      <Button
        title="Privacidad"
        secondary
        onPress={() =>
          void Linking.openURL("https://contadorganadero.com/privacidad")
        }
      />
      <Button
        title="Cerrar sesión"
        onPress={() => void auth.logout().catch((e) => setError(message(e)))}
      />
      <Button
        title="Cerrar todas las sesiones"
        disabled={auth.offline}
        secondary
        onPress={() =>
          Alert.alert(
            "Cerrar todas las sesiones",
            "También se cerrarán tus sesiones web y otros teléfonos.",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Cerrar todas",
                style: "destructive",
                onPress: () =>
                  void auth.logout(true).catch((e) => setError(message(e))),
              },
            ],
          )
        }
      />
      {!!error && <Label>{error}</Label>}
    </Screen>
  );
}
