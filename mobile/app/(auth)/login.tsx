import React, { useState } from "react";
import { Image, View } from "react-native";
import { Link, Redirect } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Screen, Field, Button, Label } from "../../src/components/ui";
import { message } from "../../src/api/client";
export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.user && !auth.locked) return <Redirect href="/(tabs)" />;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await auth.login(
        challenge ? "mfa/verify" : "login",
        challenge
          ? { mfaToken: challenge, [backup ? "backupCode" : "totpCode"]: code }
          : { email: email.trim(), password },
      );
      if (result) {
        setChallenge(result.mfaToken);
        setPassword("");
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={challenge ? "Verificación en dos pasos" : "Bienvenido a tu finca"}
    >
      <Image
        source={require("../../assets/logo.png")}
        style={{ width: 90, height: 90, alignSelf: "center" }}
        accessibilityLabel="ContadorGanadero"
      />
      {challenge ? (
        <>
          <Field
            label={
              backup ? "Código de recuperación" : "Código de tu autenticador"
            }
            value={code}
            onChangeText={setCode}
            keyboardType={backup ? "default" : "number-pad"}
            autoComplete="one-time-code"
          />
          <Button
            title={backup ? "Usar autenticador" : "Usar código de recuperación"}
            secondary
            onPress={() => {
              setBackup(!backup);
              setCode("");
            }}
          />
        </>
      ) : (
        <>
          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
          />
        </>
      )}
      {!!error && (
        <View accessibilityRole="alert">
          <Label>{error}</Label>
        </View>
      )}
      <Button
        title={
          busy ? "Verificando…" : challenge ? "Verificar" : "Iniciar sesión"
        }
        disabled={busy || auth.offline}
        onPress={() => void submit()}
      />
      {challenge ? (
        <Button
          title="Volver al inicio de sesión"
          secondary
          onPress={() => {
            setChallenge("");
            setCode("");
          }}
        />
      ) : (
        <>
          <Link href="/(auth)/registro" asChild>
            <Button title="Crear cuenta" secondary onPress={() => {}} />
          </Link>
          <Link href="/(auth)/recuperar">
            <Label>Olvidé mi contraseña</Label>
          </Link>
        </>
      )}
      {(auth.locked || auth.offline) && (
        <Button
          title="Desbloquear sesión guardada"
          secondary
          onPress={() => void auth.restore()}
        />
      )}
    </Screen>
  );
}
