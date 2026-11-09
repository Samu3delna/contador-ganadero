import React, { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { SessionGate } from "../src/components/SessionGate";
import {
  Screen,
  Row,
  Label,
  Button,
  Status,
  money,
} from "../src/components/ui";
import { useRemote } from "../src/hooks/useRemote";
import { useAuth } from "../src/auth/AuthContext";
import { api, message } from "../src/api/client";
import { queryClient } from "../src/queries/client";
export default function Protected() {
  return (
    <SessionGate>
      <Income />
    </SessionGate>
  );
}
function Income() {
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const { user, offline } = useAuth();
  const q = useRemote<{
    ingresos: {
      _id: string;
      descripcion: string;
      montoTotal: number;
      fecha: string;
    }[];
    totalPaginas: number;
  }>("/ingresos?page=" + page + "&limit=20");
  return (
    <Screen title="Ingresos">
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data?.data.ingresos.map((i) => (
        <React.Fragment key={i._id}>
          <Row
            title={i.descripcion}
            subtitle={new Date(i.fecha).toLocaleDateString("es-CR")}
            right={money(i.montoTotal)}
          />
          {["dueño", "admin"].includes(user?.rol || "") && (
            <Button
              title={"Eliminar " + i.descripcion}
              secondary
              disabled={offline}
              onPress={() =>
                Alert.alert(
                  "Eliminar ingreso",
                  "Confirma que deseas eliminar este ingreso.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Eliminar",
                      style: "destructive",
                      onPress: () =>
                        void api
                          .delete("/ingresos/" + i._id)
                          .then(() => queryClient.invalidateQueries())
                          .catch((e) => setError(message(e))),
                    },
                  ],
                )
              }
            />
          )}
        </React.Fragment>
      ))}
      {q.data?.data.ingresos.length === 0 && (
        <Label>No hay ingresos registrados.</Label>
      )}
      {!!error && <Label>{error}</Label>}
      <Button
        title="Anterior"
        secondary
        disabled={page === 1}
        onPress={() => setPage(page - 1)}
      />
      <Button
        title="Siguiente"
        secondary
        disabled={!q.data || page >= q.data.data.totalPaginas}
        onPress={() => setPage(page + 1)}
      />
    </Screen>
  );
}
