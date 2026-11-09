import React, { useState } from "react";
import { Text, View } from "react-native";
import BrandLogo from "../../src/components/BrandLogo";
import { Link, Redirect } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Screen, Field, Button, Label } from "../../src/components/ui";
import { message } from "../../src/api/client";
import { fonts, useTheme } from "../../src/theme";
export default function Login() {
  const auth = useAuth();
  const { colors: c } = useTheme();
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
    <Screen>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          paddingVertical: 16,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
          }}
        >
          <BrandLogo width={48} height={48} />
        </View>
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 21,
            color: c.ink,
            flexShrink: 1,
          }}
        >
          ContadorGanadero
        </Text>
      </View>
      <View
        style={{
          padding: 22,
          borderRadius: 28,
          backgroundColor: c.soft,
          gap: 10,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.heading,
            fontSize: 34,
            lineHeight: 40,
            color: c.ink,
          }}
        >
          {challenge ? "Un paso más de seguridad." : "Tu finca te espera."}
        </Text>
        <Label muted>
          {challenge
            ? "Verifica tu identidad para continuar."
            : "La claridad empieza con tus cuentas al día."}
        </Label>
      </View>
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
          <Link
            href="/(auth)/recuperar"
            style={{ minHeight: 44, paddingVertical: 12 }}
          >
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
