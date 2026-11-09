import React from "react";
import { router } from "expo-router";
import { Screen, Row, Status } from "../../src/components/ui";
import { useRemote } from "../../src/hooks/useRemote";
export default function Inventario() {
  const q = useRemote<Record<string, number>>("/inventario/resumen");
  return (
    <Screen title="Inventario de tu finca">
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {[
        ["bovinos", "Bovinos", "totalBovinos"],
        ["aves", "Aves", "totalAves"],
        ["peces", "Peces", "totalPeces"],
        ["colmenas", "Abejas", "totalMiel"],
      ].map(([type, label, key]) => (
        <Row
          key={type}
          title={label}
          subtitle={
            q.data
              ? String(q.data.data[key] || 0) +
                (type === "colmenas" ? " kg de miel" : " animales")
              : undefined
          }
          onPress={() => router.push("/inventario/" + type)}
        />
      ))}
    </Screen>
  );
}
