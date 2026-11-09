import React, { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Button,
  Row,
  Label,
  Status,
  money,
  Feedback,
} from "../../src/components/ui";
import { useRemote } from "../../src/hooks/useRemote";
import { useAuth } from "../../src/auth/AuthContext";
import { uploadXml } from "../../src/api/files";
import { message } from "../../src/api/client";
import { queryClient } from "../../src/queries/client";
import type { Page, Invoice } from "../../src/types/api";
export default function Facturas() {
  const { offline } = useAuth();
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const q = useRemote<Page<Invoice>>(
    "/facturas?page=" + page + "&limit=20" + (review ? "&estado=revision" : ""),
    true,
  );
  return (
    <Screen title="Facturas">
      <Button
        title={busy ? "Procesando XML…" : "Cargar XML"}
        disabled={offline || busy}
        onPress={() => {
          setBusy(true);
          setResult("");
          void uploadXml()
            .then((data) => {
              if (data) {
                setResult(
                  data.duplicada
                    ? "Esta factura ya estaba registrada."
                    : data.mensaje || "Factura procesada.",
                );
                void queryClient.invalidateQueries();
              }
            })
            .catch((e) => setResult(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Label muted>
        Archivos XML de hasta 2 MB. Las fotografías no se procesan.
      </Label>
      {!!result && <Feedback>{result}</Feedback>}
      <Button
        title={review ? "Mostrar todas" : "Mostrar en revisión"}
        secondary
        onPress={() => {
          setReview(!review);
          setPage(1);
        }}
      />
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {q.data?.data.facturas.map((f) => (
        <Row
          key={f._id}
          title={f.emisor?.nombre || "Factura"}
          subtitle={
            f.estado +
            " · " +
            new Date(f.fechaEmision).toLocaleDateString("es-CR")
          }
          right={money(f.resumenFactura?.totalComprobante)}
          onPress={() => router.push("/facturas/" + f._id)}
        />
      ))}
      {q.data?.data.total === 0 && (
        <Label>Aún no hay facturas con este filtro.</Label>
      )}
      <Label muted>
        Página {page} de {q.data?.data.totalPaginas || 1}
      </Label>
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
      {q.data && (
        <Label muted>
          Actualizado: {new Date(q.data.updated).toLocaleString("es-CR")}
        </Label>
      )}
    </Screen>
  );
}
