import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import Movimiento from "../app/movimiento";
import { api } from "../src/api/client";
import Login from "../app/(auth)/login";
import Registro from "../app/(auth)/registro";
import { Status } from "../src/components/ui";
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  // Jest factories are hoisted; resolve the mock native view inside the factory.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require("react-native").View,
}));
const mockLogin = jest.fn();
const mockAuth = {
  user: null,
  offline: false,
  locked: false,
  notice: "",
  loading: false,
  login: mockLogin,
  restore: jest.fn(),
  logout: jest.fn(),
};
jest.mock("../src/auth/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { back: jest.fn() },
}));
jest.mock("../src/api/client", () => ({
  message: (e: Error) => e.message,
  authRequest: { post: jest.fn() },
  api: { post: jest.fn(async () => ({ data: {} })) },
}));
jest.mock("../src/components/SessionGate", () => ({
  SessionGate: ({ children }: { children: React.ReactNode }) => children,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.offline = false;
});
test("login tiene campos accesibles y envía credenciales", async () => {
  mockLogin.mockResolvedValue(null);
  await render(<Login />);
  await fireEvent.changeText(
    screen.getByLabelText("Correo electrónico"),
    "finca@example.test",
  );
  await fireEvent.changeText(screen.getByLabelText("Contraseña"), "password");
  await fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith("login", {
      email: "finca@example.test",
      password: "password",
    }),
  );
});
test("MFA usa desafío sin volver a enviar contraseña", async () => {
  mockLogin
    .mockResolvedValueOnce({ mfaRequired: true, mfaToken: "challenge" })
    .mockResolvedValueOnce(null);
  await render(<Login />);
  await fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Código de tu autenticador")).toBeTruthy(),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Código de tu autenticador"),
    "123456",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Verificar" }));
  expect(mockLogin).toHaveBeenLastCalledWith("mfa/verify", {
    mfaToken: "challenge",
    totpCode: "123456",
  });
});
test("registro exige consentimiento", async () => {
  await render(<Registro />);
  expect(
    screen.getByRole("button", { name: "Crear cuenta gratuita" }),
  ).toBeDisabled();
});
test("offline se anuncia y deshabilita login", async () => {
  mockAuth.offline = true;
  await render(<Login />);
  expect(screen.getByText("Sin conexión")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeDisabled();
});
test("error se muestra con acción reintentar", async () => {
  const retry = jest.fn();
  await render(
    <Status
      pending={false}
      error={new Error("No tienes permiso")}
      retry={retry}
    />,
  );
  expect(screen.getByText("No tienes permiso")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalled();
});

test("gasto valida obligatorios y envía montos a la API sin tenant del cliente", async () => {
  await render(<Movimiento />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Guardar movimiento" }),
  );
  expect(screen.getByText("Completa los campos obligatorios.")).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("Descripción"),
    "Concentrado",
  );
  await fireEvent.changeText(screen.getByLabelText("Proveedor"), "Cooperativa");
  await fireEvent.changeText(
    screen.getByLabelText("Monto antes de impuesto (₡)"),
    "2500",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Guardar movimiento" }),
  );
  expect(api.post).toHaveBeenCalledWith(
    "/facturas/manual",
    expect.objectContaining({ descripcion: "Concentrado", totalVenta: 2500 }),
  );
  expect((api.post as jest.Mock).mock.calls[0][1]).not.toHaveProperty(
    "tenantId",
  );
});
