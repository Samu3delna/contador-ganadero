import React, { useState } from "react";
import { router } from "expo-router";
import { authRequest, message } from "../../src/api/client";
import { Screen, Field, Button, Label } from "../../src/components/ui";
import { useAuth } from "../../src/auth/AuthContext";
export default function Recuperar() {
  const { offline } = useAuth();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="Recuperar contraseña">
      <Label>
        Te enviaremos un enlace para restablecer tu contraseña de forma segura.
      </Label>
      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {!!result && <Label>{result}</Label>}
      <Button
        title="Enviar enlace"
        disabled={busy || offline}
        onPress={() => {
          setBusy(true);
          void authRequest
            .post("/auth/forgot-password", { email: email.trim() })
            .then(() =>
              setResult(
                "Si el correo está registrado, recibirás las instrucciones.",
              ),
            )
            .catch((e) => setResult(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Button title="Volver" secondary onPress={() => router.back()} />
    </Screen>
  );
}
