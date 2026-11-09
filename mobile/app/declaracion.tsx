import React from "react";
import { router, useLocalSearchParams } from "expo-router";
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
type Declaration = {
  tipo: string;
  periodoFiscal: number;
  cuatrimestre?: number;
  estado: string;
  ivaCobrado: number;
  ivaPagado: number;
  ivaResultante: number;
  ingresosBrutos: number;
  gastosDeducibles: number;
  utilidadNeta: number;
  impuestoFinal: number;
};
export default function Protected() {
  return (
    <SessionGate>
      <Detail />
    </SessionGate>
  );
}
function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRemote<Declaration>(
    "/declaraciones/" + encodeURIComponent(id || ""),
  );
  const item = q.data?.data;
  return (
    <Screen title="Declaración guardada">
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {item && (
        <>
          <Label title>
            {item.tipo} · {item.periodoFiscal}
          </Label>
          <Label>
            {item.estado}
            {item.cuatrimestre ? " · Cuatrimestre " + item.cuatrimestre : ""}
          </Label>
          {(item.tipo === "D-135-1"
            ? [
                ["IVA cobrado", item.ivaCobrado],
                ["IVA pagado", item.ivaPagado],
                ["IVA resultante", item.ivaResultante],
              ]
            : [
                ["Ingresos brutos", item.ingresosBrutos],
                ["Gastos deducibles", item.gastosDeducibles],
                ["Utilidad neta", item.utilidadNeta],
                ["Impuesto final", item.impuestoFinal],
              ]
          ).map(([label, value]) => (
            <Row
              key={String(label)}
              title={String(label)}
              right={money(value)}
            />
          ))}
          <Label muted>
            Importes calculados por el servidor. Esta consulta no presenta una
            declaración ante Hacienda.
          </Label>
        </>
      )}
    </Screen>
  );
}
