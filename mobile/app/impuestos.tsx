import React from "react";
import { router } from "expo-router";
import { SessionGate } from "../src/components/SessionGate";
import {
  Screen,
  Label,
  Row,
  Status,
  Button,
  money,
} from "../src/components/ui";
import { useRemote } from "../src/hooks/useRemote";
export default function Protected() {
  return (
    <SessionGate>
      <Taxes />
    </SessionGate>
  );
}
function Taxes() {
  const q = useRemote<{
    resumen: { ivaAPagar?: number; rentaAPagar?: number };
    periodoFiscal: number;
  }>("/impuestos/proyeccion");
  const d = useRemote<{
    declaraciones?: {
      _id: string;
      tipo: string;
      periodoFiscal: number;
      estado: string;
    }[];
  }>("/declaraciones");
  return (
    <Screen title="Resumen tributario">
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data && (
        <>
          <Label>Período fiscal {q.data.data.periodoFiscal}</Label>
          <Row
            title="IVA proyectado"
            right={money(q.data.data.resumen.ivaAPagar)}
          />
          <Row
            title="Renta proyectada"
            right={money(q.data.data.resumen.rentaAPagar)}
          />
          <Label muted>
            Cálculos proporcionados por el servidor. Consulta a tu contador
            antes de presentar declaraciones.
          </Label>
        </>
      )}
      <Label title>Declaraciones disponibles</Label>
      <Status
        pending={d.isPending}
        error={d.error}
        retry={() => void d.refetch()}
      />
      {d.data?.data.declaraciones?.map((item) => (
        <Row
          key={item._id}
          title={item.tipo + " " + item.periodoFiscal}
          subtitle={item.estado}
          onPress={() =>
            router.push({ pathname: "/declaracion", params: { id: item._id } })
          }
        />
      ))}
      {d.data && !d.data.data.declaraciones?.length && (
        <Label>No hay declaraciones guardadas.</Label>
      )}
    </Screen>
  );
}
