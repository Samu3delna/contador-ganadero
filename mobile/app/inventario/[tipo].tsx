import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Row,
  Status,
  Button,
  Field,
  Label,
} from "../../src/components/ui";
import { useRemote } from "../../src/hooks/useRemote";
import { useAuth } from "../../src/auth/AuthContext";
import { api, message } from "../../src/api/client";
import { queryClient } from "../../src/queries/client";
const configs: Record<string, { title: string; list: string; id: string }> = {
  bovinos: { title: "Bovinos", list: "bovinos", id: "tagId" },
  aves: { title: "Aves", list: "lotesAves", id: "loteId" },
  peces: { title: "Peces", list: "estanques", id: "estanqueId" },
  colmenas: { title: "Abejas", list: "colmenas", id: "colmenaId" },
};
export default function Species() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const cfg = configs[tipo];
  const q =
    useRemote<Record<string, Record<string, string | boolean>[]>>(
      "/inventario",
    );
  const { offline, user } = useAuth();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [female, setFemale] = useState(true);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cfg)
    return (
      <Screen title="Especie no encontrada">
        <Button title="Volver" onPress={() => router.back()} />
      </Screen>
    );
  return (
    <Screen title={cfg.title}>
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data?.data[cfg.list]
        ?.filter((item) => item.activo !== false)
        .map((item) => (
          <Row
            key={String(item._id)}
            title={String(item[cfg.id])}
            subtitle={String(item.nombre || item.especie || "")}
          />
        ))}
      {q.data && !q.data.data[cfg.list]?.length && (
        <Label>No hay registros de esta especie.</Label>
      )}
      {user?.rol !== "contador" && (
        <>
          <Label title>Agregar registro</Label>
          <Field label="Identificador" value={id} onChangeText={setId} />
          {tipo === "bovinos" && (
            <>
              <Field label="Nombre" value={name} onChangeText={setName} />
              <Button
                title={female ? "Sexo: hembra" : "Sexo: macho"}
                secondary
                onPress={() => setFemale(!female)}
              />
            </>
          )}
          <Button
            title={busy ? "Guardando…" : "Agregar"}
            disabled={busy || offline}
            onPress={() => {
              if (!id.trim()) {
                setResult("Ingresa el identificador.");
                return;
              }
              setBusy(true);
              void api
                .post("/inventario/" + tipo, {
                  [cfg.id]: id.trim(),
                  ...(tipo === "bovinos"
                    ? { nombre: name, sexo: female ? "hembra" : "macho" }
                    : {}),
                })
                .then(() => {
                  setId("");
                  setResult("Registro agregado.");
                  void queryClient.invalidateQueries();
                })
                .catch((e) => setResult(message(e)))
                .finally(() => setBusy(false));
            }}
          />
        </>
      )}
      {!!result && <Label>{result}</Label>}
    </Screen>
  );
}
