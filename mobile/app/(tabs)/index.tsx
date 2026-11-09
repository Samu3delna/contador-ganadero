import React from "react";
import { Image, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Label,
  Button,
  Row,
  Status,
  money,
  styles,
} from "../../src/components/ui";
import { useRemote } from "../../src/hooks/useRemote";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme";
import type { Dashboard, Invoice, Page } from "../../src/types/api";
export default function Home() {
  const { user, offline } = useAuth();
  const { colors: c } = useTheme();
  const q = useRemote<Dashboard>("/dashboard/resumen", true);
  const invoices = useRemote<Page<Invoice>>("/facturas?page=1&limit=20", true);
  const stock = useRemote<Record<string, number>>("/inventario/resumen");
  const d = q.data?.data;
  return (
    <Screen>
      <View style={[styles.row, { alignItems: "center" }]}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 46, height: 46 }}
        />
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            fontSize: 21,
            color: c.ink,
          }}
        >
          ContadorGanadero
        </Text>
      </View>
      <Label>
        {user?.nombreFinca || user?.tenant?.nombreFinca || "Mi finca"}
      </Label>
      <Label title>Tu finca, en números</Label>
      <Label muted>
        Resumen del período fiscal{" "}
        {d?.periodoFiscal || new Date().getFullYear()}
      </Label>
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {d && (
        <>
          <Label>Balance del período</Label>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 48,
              color: c.green,
            }}
          >
            {money(d.resumen.totalIngresos - d.resumen.totalGastos)}
          </Text>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Label muted>Ingresos</Label>
              <Label title>{money(d.resumen.totalIngresos)}</Label>
            </View>
            <View style={styles.grow}>
              <Label muted>Gastos</Label>
              <Label title>{money(d.resumen.totalGastos)}</Label>
            </View>
          </View>
        </>
      )}
      <Button
        title="Registrar movimiento"
        disabled={offline}
        onPress={() => router.push("/movimiento")}
      />
      <Label title>Facturas recientes</Label>
      {invoices.data && (
        <Label muted>{invoices.data.data.total} facturas registradas</Label>
      )}
      <Status
        pending={invoices.isPending}
        error={invoices.error}
        retry={() => void invoices.refetch()}
      />
      {invoices.data?.data.facturas.slice(0, 2).map((f) => (
        <Row
          key={f._id}
          title={f.emisor?.nombre || "Factura"}
          subtitle={f.estado === "revision" ? "En revisión" : f.estado}
          right={money(f.resumenFactura?.totalComprobante)}
          onPress={() => router.push("/facturas/" + f._id)}
        />
      ))}
      {invoices.data?.data.total === 0 && (
        <Label muted>Aún no hay facturas. Carga tu primer XML.</Label>
      )}
      <Button
        title="Ver todas las facturas"
        secondary
        onPress={() => router.push("/(tabs)/facturas")}
      />
      {stock.data && (
        <Row
          title="Inventario de tu finca"
          subtitle={
            String(stock.data.data.totalBovinos || 0) +
            " bovinos · " +
            String(stock.data.data.totalAves || 0) +
            " aves"
          }
          onPress={() => router.push("/(tabs)/inventario")}
        />
      )}
      <Row
        title="Resumen de impuestos"
        subtitle={
          d
            ? "IVA proyectado: " + money(d.resumen.ivaAPagar)
            : "Consulta los cálculos del período"
        }
        onPress={() => router.push("/impuestos")}
      />
      <Label muted>
        Plan {user?.plan === "pro" ? "Pro" : "Free"}
        {q.data
          ? " · Actualizado " + new Date(q.data.updated).toLocaleString("es-CR")
          : ""}
      </Label>
    </Screen>
  );
}
