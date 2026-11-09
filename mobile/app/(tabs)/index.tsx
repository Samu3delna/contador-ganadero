import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { fonts, useTheme } from "../../src/theme";
import type { Dashboard, Invoice, Page } from "../../src/types/api";
import BrandLogo from "../../src/components/BrandLogo";

export default function Home() {
  const { user, offline } = useAuth();
  const { colors: c } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const [hidden, setHidden] = useState(false);
  const q = useRemote<Dashboard>("/dashboard/resumen", true);
  const invoices = useRemote<Page<Invoice>>("/facturas?page=1&limit=20", true);
  const stock = useRemote<Record<string, number>>("/inventario/resumen");
  const d = q.data?.data;
  const roomy = fontScale > 1.3 || width < 360;
  const value = (amount: unknown) => (hidden ? "••••••" : money(amount));
  const time = new Date().getHours();
  const greeting =
    time < 12 ? "Buenos días" : time < 18 ? "Buenas tardes" : "Buenas noches";
  return (
    <Screen>
      <View style={[styles.row, { alignItems: "center", flexWrap: "wrap" }]}>
        <View style={home.logo}>
          <BrandLogo width={38} height={38} />
        </View>
        <Text style={[home.brand, { color: c.ink, flex: 1 }]}>
          ContadorGanadero
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir mi perfil"
          onPress={() => router.push("/perfil")}
          style={[
            home.avatar,
            { backgroundColor: c.soft, borderColor: c.border },
          ]}
        >
          <Feather name="user" size={21} color={c.green} />
        </Pressable>
      </View>
      <View
        style={[
          styles.row,
          {
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          },
        ]}
      >
        <Text style={[home.farm, { color: c.muted, flexShrink: 1 }]}>
          {user?.nombreFinca || user?.tenant?.nombreFinca || "Mi finca"}
        </Text>
        <Text
          style={[
            home.plan,
            { color: c.green, backgroundColor: c.soft, borderColor: c.border },
          ]}
        >
          Plan {user?.plan === "pro" ? "Pro" : "Free"}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Label muted>
          {greeting}
          {user?.nombre ? ", " + user.nombre.split(" ")[0] : ""}
        </Label>
        <Text
          accessibilityRole="header"
          style={[home.headline, { color: c.ink }]}
        >
          Tu finca.{"\n"}Todo en su lugar.
        </Text>
      </View>
      <Status
        pending={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {d && (
        <View style={[home.balance, { backgroundColor: c.green }]}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[home.contour, { borderColor: c.onGreen }]}
          />
          <View
            style={[
              styles.row,
              {
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "space-between",
              },
            ]}
          >
            <Text style={[home.balanceLabel, { color: c.onGreen, flex: 1 }]}>
              Balance del período fiscal {d.periodoFiscal}
            </Text>
            <Pressable
              onPress={() => setHidden((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                hidden ? "Mostrar balance" : "Ocultar balance"
              }
              style={home.visibility}
            >
              <Feather
                name={hidden ? "eye-off" : "eye"}
                size={20}
                color={c.onGreen}
              />
            </Pressable>
          </View>
          <Text style={[home.amount, { color: c.onGreen }]}>
            {value(d.resumen.totalIngresos - d.resumen.totalGastos)}
          </Text>
          <View style={[styles.row, roomy && { flexDirection: "column" }]}>
            {[
              ["Ingresos", d.resumen.totalIngresos],
              ["Gastos", d.resumen.totalGastos],
            ].map(([label, amount]) => (
              <View key={label} style={[styles.grow, { gap: 4 }]}>
                <Text style={[home.balanceLabel, { color: c.onGreen }]}>
                  {label}
                </Text>
                <Text style={[home.subAmount, { color: c.onGreen }]}>
                  {value(amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={[styles.row, roomy && { flexDirection: "column" }]}>
        <View style={styles.grow}>
          <Button
            title="Registrar movimiento"
            disabled={offline}
            onPress={() => router.push("/movimiento")}
            icon={<Feather name="plus" size={22} color={c.onGreen} />}
          />
        </View>
        <View style={styles.grow}>
          <Button
            title="Cargar XML"
            secondary
            disabled={offline}
            onPress={() => router.push("/(tabs)/facturas")}
            icon={<Feather name="upload" size={22} color={c.green} />}
          />
        </View>
      </View>
      <Label title>Facturas recientes</Label>
      {invoices.data && (
        <Label muted>{invoices.data.data.total} facturas registradas</Label>
      )}
      <Status
        pending={invoices.isPending}
        error={invoices.error}
        retry={() => void invoices.refetch()}
      />
      <View>
        {invoices.data?.data.facturas.slice(0, 2).map((f) => (
          <Row
            key={f._id}
            title={f.emisor?.nombre || "Factura"}
            subtitle={
              f.estado === "revision"
                ? "En revisión"
                : f.estado === "procesada"
                  ? "Procesada"
                  : f.estado
            }
            right={money(f.resumenFactura?.totalComprobante)}
            onPress={() => router.push("/facturas/" + f._id)}
          />
        ))}
        {invoices.data?.data.total === 0 && (
          <Label muted>Aún no hay facturas. Carga tu primer XML.</Label>
        )}
      </View>
      <Button
        title="Ver todas las facturas"
        secondary
        onPress={() => router.push("/(tabs)/facturas")}
      />
      {stock.data && (
        <View style={[home.summary, { backgroundColor: c.soft }]}>
          <Feather name="sun" size={24} color={c.green} />
          <Label title>Tu finca sigue creciendo</Label>
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
        </View>
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
      <View style={[styles.row, { alignItems: "center", flexWrap: "wrap" }]}>
        <Feather
          name={offline ? "wifi-off" : "check-circle"}
          size={17}
          color={c.green}
        />
        <View style={styles.grow}>
          <Label muted>
            {q.data
              ? "Actualizado " +
                new Date(q.data.updated).toLocaleString("es-CR")
              : "Esperando sincronización"}
          </Label>
        </View>
      </View>
    </Screen>
  );
}
const home = StyleSheet.create({
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#FFFFFF" },
  brand: { fontFamily: fonts.heading, fontSize: 18 },
  avatar: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  farm: { fontFamily: fonts.body, fontSize: 14 },
  plan: {
    fontFamily: fonts.strong,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
  },
  balance: { padding: 22, borderRadius: 28, overflow: "hidden", gap: 10 },
  contour: {
    position: "absolute",
    width: 170,
    height: 170,
    right: -70,
    top: -100,
    borderRadius: 100,
    borderWidth: 1,
    opacity: 0.2,
  },
  balanceLabel: { fontFamily: fonts.body, fontSize: 14 },
  amount: {
    fontFamily: fonts.strong,
    fontSize: 42,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
    marginBottom: 6,
  },
  subAmount: {
    fontFamily: fonts.strong,
    fontSize: 19,
    fontVariant: ["tabular-nums"],
  },
  visibility: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { padding: 20, borderRadius: 24, gap: 12 },
});
