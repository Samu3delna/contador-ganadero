import React, { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Label,
  Row,
  Status,
  Button,
  money,
} from "../../src/components/ui";
import { useRemote } from "../../src/hooks/useRemote";
import { useAuth } from "../../src/auth/AuthContext";
import { api, message } from "../../src/api/client";
import { openInvoiceFile } from "../../src/api/files";
import { queryClient } from "../../src/queries/client";
import type { Invoice } from "../../src/types/api";
export default function Detalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { offline, user } = useAuth();
  const q = useRemote<Invoice>("/facturas/" + encodeURIComponent(id));
  const f = q.data?.data;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download(ext: "pdf" | "xml") {
    setBusy(true);
    try {
      await openInvoiceFile(id, ext);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Detalle de factura">
      <Button title="Volver" secondary onPress={() => router.back()} />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {f && (
        <>
          <Label title>{f.emisor?.nombre || "Factura"}</Label>
          <Row
            title="Total"
            right={money(f.resumenFactura?.totalComprobante)}
          />
          <Row title="Estado" right={f.estado} />
          <Row title="Categoría IA" right={f.categoriaIA || "Sin clasificar"} />
          <Row
            title="Deducible"
            right={f.esDeducible === false ? "No" : "Sí"}
          />
          <Label>Tarifa agropecuaria</Label>
          {f.alertasTarifa?.length ? (
            f.alertasTarifa.map((a, i) => (
              <Label key={i}>{a.mensaje || "Revisa la tarifa aplicada."}</Label>
            ))
          ) : (
            <Label muted>Sin alertas de tarifa informadas.</Label>
          )}
          <Button
            title="Abrir XML"
            disabled={offline || busy}
            onPress={() => void download("xml")}
          />
          <Button
            title="Abrir PDF"
            secondary
            disabled={offline || busy}
            onPress={() => void download("pdf")}
          />
          {["dueño", "admin"].includes(user?.rol || "") && (
            <Button
              title="Eliminar factura"
              secondary
              disabled={offline || busy}
              onPress={() =>
                Alert.alert(
                  "Eliminar factura",
                  "Esta acción eliminará el registro.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Eliminar",
                      style: "destructive",
                      onPress: () => {
                        setBusy(true);
                        void api
                          .delete("/facturas/" + id)
                          .then(() => {
                            void queryClient.invalidateQueries();
                            router.back();
                          })
                          .catch((e) => setError(message(e)))
                          .finally(() => setBusy(false));
                      },
                    },
                  ],
                )
              }
            />
          )}
        </>
      )}
      {!!error && <Label>{error}</Label>}
    </Screen>
  );
}
