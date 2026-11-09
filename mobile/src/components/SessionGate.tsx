import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Screen, Button, Label } from "./ui";
export function SessionGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.loading)
    return (
      <Screen>
        <Label>Preparando tu finca…</Label>
      </Screen>
    );
  if (!auth.user) return <Redirect href="/(auth)/login" />;
  if (auth.locked)
    return (
      <Screen title="Desbloquea tu finca">
        <Button title="Desbloquear" onPress={() => void auth.restore()} />
        <Button
          title="Cerrar sesión"
          secondary
          onPress={() => void auth.logout()}
        />
      </Screen>
    );
  return children;
}
