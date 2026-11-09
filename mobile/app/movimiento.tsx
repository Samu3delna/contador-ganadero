import React, { useState } from "react";
import { router } from "expo-router";
import { SessionGate } from "../src/components/SessionGate";
import { Screen, Label, Field, Button, Feedback } from "../src/components/ui";
import { useAuth } from "../src/auth/AuthContext";
import { api, message } from "../src/api/client";
import { amount, civilDate, today } from "../src/utils/forms";
import { queryClient } from "../src/queries/client";
export default function Protected() {
  return (
    <SessionGate>
      <Movimiento />
    </SessionGate>
  );
}
function Movimiento() {
  const { offline, user } = useAuth();
  const [income, setIncome] = useState(false);
  const [fecha, setFecha] = useState(today());
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [value, setValue] = useState("");
  const [tax, setTax] = useState("0");
  const [category, setCategory] = useState("otros_ingresos");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setResult("");
    try {
      if (offline) throw new Error("Conéctate para registrar cambios.");
      if (!description.trim() || (!income && !supplier.trim()))
        throw new Error("Completa los campos obligatorios.");
      const date = civilDate(fecha),
        total = amount(value),
        impuesto = amount(tax);
      await api.post(
        income ? "/ingresos" : "/facturas/manual",
        income
          ? {
              fecha: date,
              descripcion: description,
              categoriaIngreso: category,
              montoSubtotal: total,
              tasaIVA: impuesto,
            }
          : {
              fechaEmision: date,
              emisorNombre: supplier,
              descripcion: description,
              totalVenta: total,
              totalImpuesto: impuesto,
            },
      );
      await queryClient.invalidateQueries();
      setResult("Movimiento registrado correctamente.");
      setValue("");
      setDescription("");
    } catch (e) {
      setResult(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={income ? "Registrar ingreso" : "Registrar gasto"}>
      <Button
        title={income ? "Cambiar a gasto" : "Cambiar a ingreso"}
        secondary
        disabled={user?.rol === "peon"}
        onPress={() => {
          setIncome(!income);
          setTax("0");
        }}
      />
      <Field label="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} />
      <Field
        label="Descripción"
        value={description}
        onChangeText={setDescription}
      />
      {!income && (
        <Field label="Proveedor" value={supplier} onChangeText={setSupplier} />
      )}
      <Field
        label="Monto antes de impuesto (₡)"
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
      />
      <Field
        label={
          income
            ? "Tarifa IVA indicada en tu comprobante (%)"
            : "Monto de impuesto (₡)"
        }
        value={tax}
        onChangeText={setTax}
        keyboardType="decimal-pad"
      />
      {income && (
        <>
          {[
            ["otros_ingresos", "Otros ingresos"],
            ["venta_leche", "Venta de leche"],
            ["venta_ganado_pie", "Venta de ganado en pie"],
          ].map(([key, label]) => (
            <Button
              key={key}
              title={(category === key ? "Seleccionado: " : "") + label}
              secondary
              onPress={() => setCategory(key)}
            />
          ))}
        </>
      )}
      <Label muted>El servidor calcula y valida los importes fiscales.</Label>
      {!!result && <Feedback>{result}</Feedback>}
      <Button
        title={busy ? "Guardando…" : "Guardar movimiento"}
        disabled={busy || offline}
        onPress={() => void submit()}
      />
      <Button title="Volver" secondary onPress={() => router.back()} />
    </Screen>
  );
}
