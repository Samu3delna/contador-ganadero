import React, { useState } from "react";
import { Linking, Switch, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Screen, Field, Button, Label } from "../../src/components/ui";
import { message } from "../../src/api/client";
export default function Registro() {
  const auth = useAuth();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    nombreFinca: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Redirect href="/(tabs)" />;
  return (
    <Screen title="Crear tu cuenta">
      {Object.entries({
        nombre: "Tu nombre",
        nombreFinca: "Nombre de la finca",
        email: "Correo electrónico",
        password: "Contraseña",
      }).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={form[key as keyof typeof form]}
          onChangeText={(value) => setForm({ ...form, [key]: value })}
          secureTextEntry={key === "password"}
          autoCapitalize={key === "email" || key === "password" ? "none" : "sentences"}
          autoCorrect={key !== "password" && key !== "email"}
          keyboardType={key === "email" ? "email-address" : "default"}
        />
      ))}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Switch
          accessibilityLabel="Aceptar términos y privacidad"
          value={accepted}
          onValueChange={setAccepted}
        />
        <Label>Acepto términos y privacidad</Label>
      </View>
      <Button
        title="Leer términos"
        secondary
        onPress={() =>
          void Linking.openURL("https://contadorganadero.com/terminos")
        }
      />
      {!!error && <Label>{error}</Label>}
      <Button
        title={busy ? "Creando…" : "Crear cuenta gratuita"}
        disabled={!accepted || busy || auth.offline}
        onPress={() => {
          setBusy(true);
          void auth
            .login("registro", { ...form, aceptaTerminos: accepted })
            .catch((e) => setError(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Button title="Volver" secondary onPress={() => router.back()} />
    </Screen>
  );
}
