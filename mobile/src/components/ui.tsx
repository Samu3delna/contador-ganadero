import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { useAuth } from "../auth/AuthContext";
import { message } from "../api/client";
export const money = (n: unknown) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
export function Label({
  children,
  title = false,
  muted = false,
}: {
  children: React.ReactNode;
  title?: boolean;
  muted?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Text
      style={{
        color: muted ? c.muted : c.ink,
        fontFamily: title ? "Outfit_600SemiBold" : "Inter_400Regular",
        fontSize: title ? 26 : 16,
        lineHeight: title ? 32 : 24,
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        padding: 13,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: c.green,
        backgroundColor: secondary ? c.surface : c.green,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: secondary ? c.green : c.bg,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            minHeight: 50,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 10,
            padding: 12,
            color: c.ink,
            backgroundColor: c.surface,
            fontSize: 16,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Screen({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  const auth = useAuth();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
      >
        {title && <Label title>{title}</Label>}
        {auth.offline && (
          <View
            accessibilityRole="alert"
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: c.amber,
              borderRadius: 10,
            }}
          >
            <Label>Sin conexión</Label>
            <Label muted>Datos almacenados localmente</Label>
          </View>
        )}
        {!!auth.notice && <Label muted>{auth.notice}</Label>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Status({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
}) {
  const { colors: c } = useTheme();
  if (pending)
    return (
      <ActivityIndicator accessibilityLabel="Cargando datos" color={c.green} />
    );
  if (error)
    return (
      <View accessibilityRole="alert" style={{ gap: 12 }}>
        <Label>{message(error)}</Label>
        <Button title="Reintentar" secondary onPress={retry} />
      </View>
    );
  return null;
}
export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
}) {
  const { colors: c } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 17,
        borderBottomWidth: 1,
        borderColor: c.border,
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Label>{title}</Label>
        {subtitle && <Label muted>{subtitle}</Label>}
      </View>
      {right && <Label>{right}</Label>}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}
export const styles = StyleSheet.create({
  page: { padding: 22, gap: 20, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
});
