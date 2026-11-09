import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useAnimatedValue,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, useTheme } from "../theme";
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
        fontFamily: title ? fonts.heading : fonts.body,
        fontSize: title ? 26 : 16,
        lineHeight: title ? 32 : 24,
        flexShrink: 1,
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
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: React.ReactNode;
}) {
  const { colors: c, reduceMotion } = useTheme();
  const scale = useAnimatedValue(1);
  const animate = (pressed: boolean) => {
    scale.stopAnimation();
    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: pressed ? 0.97 : 1,
      duration: 160,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    }).start();
  };
  useEffect(() => {
    if (reduceMotion || disabled) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduceMotion, disabled, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(true)}
        onPressOut={() => animate(false)}
        style={({ pressed }) => ({
          minHeight: icon ? 72 : 52,
          padding: 14,
          gap: 7,
          borderRadius: icon ? 20 : 24,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: secondary ? c.border : c.green,
          backgroundColor: secondary ? c.surface : c.green,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        })}
      >
        {icon}
        <Text
          style={{
            fontFamily: fonts.strong,
            fontSize: 16,
            textAlign: "center",
            color: secondary ? c.ink : c.onGreen,
          }}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
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
            borderColor: c.muted,
            borderRadius: 18,
            padding: 14,
            color: c.ink,
            backgroundColor: c.surface,
            fontSize: 16,
            fontFamily: fonts.body,
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
      </KeyboardAvoidingView>
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
      <View
        accessibilityRole="alert"
        style={{
          gap: 12,
          padding: 18,
          borderRadius: 20,
          backgroundColor: c.soft,
        }}
      >
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
  icon,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderColor: c.border,
        alignItems: "center",
      }}
    >
      {icon && (
        <View
          style={{
            minWidth: 42,
            minHeight: 42,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.soft,
          }}
        >
          {icon}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label>{title}</Label>
        {subtitle && <Label muted>{subtitle}</Label>}
      </View>
      {right && (
        <View style={{ maxWidth: "42%" }}>
          <Label>{right}</Label>
        </View>
      )}
      {onPress && (
        <Text accessible={false} style={{ color: c.green, fontSize: 24 }}>
          ›
        </Text>
      )}
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
export function Feedback({ children }: { children: string }) {
  const { reduceMotion, colors: c } = useTheme();
  const opacity = useAnimatedValue(1);
  useEffect(() => {
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.4);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }).start();
    return () => opacity.stopAnimation();
  }, [children, opacity, reduceMotion]);
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        opacity,
        backgroundColor: c.soft,
        padding: 16,
        borderRadius: 18,
      }}
    >
      <Label>{children}</Label>
    </Animated.View>
  );
}
export const styles = StyleSheet.create({
  page: { padding: 22, gap: 18, paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
});
