import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import Home from "../app/(tabs)/index";
import { ThemeProvider, useTheme } from "../src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
}));
jest.mock("react-native-safe-area-context", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require("react-native").View,
}));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
let mockOffline = false;
jest.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      nombre: "Ana Fernández",
      nombreFinca: "Finca de prueba",
      plan: "free",
    },
    offline: mockOffline,
    notice: "",
  }),
}));
const mockRequests: string[] = [];
jest.mock("../src/hooks/useRemote", () => ({
  useRemote: (url: string) => {
    mockRequests.push(url);
    return {
      isPending: false,
      error: null,
      refetch: jest.fn(),
      data: {
        updated: 1794225600000,
        data:
          url === "/dashboard/resumen"
            ? {
                periodoFiscal: 2026,
                resumen: {
                  totalIngresos: 300000,
                  totalGastos: 125000,
                  ivaAPagar: 2500,
                },
              }
            : url.startsWith("/facturas")
              ? {
                  total: 1,
                  facturas: [
                    {
                      _id: "factura-actual",
                      emisor: { nombre: "Proveedor de la finca" },
                      estado: "revision",
                      resumenFactura: { totalComprobante: 125000 },
                    },
                  ],
                }
              : { totalBovinos: 12, totalAves: 85 },
      },
    };
  },
}));
jest.mock("../src/api/client", () => ({ message: (e: Error) => e.message }));
beforeEach(() => {
  mockOffline = false;
  mockRequests.length = 0;
  jest.clearAllMocks();
});

test("Inicio Terreno muestra datos del tenant y conserva rutas de datos y navegación", async () => {
  await render(<Home />);
  expect(screen.getByText("Finca de prueba")).toBeTruthy();
  expect(screen.getByText("Plan Free")).toBeTruthy();
  expect(screen.getByText("Proveedor de la finca")).toBeTruthy();
  expect(screen.getByText(/175[.,\s]?000/)).toBeTruthy();
  expect(mockRequests).toEqual(
    expect.arrayContaining([
      "/dashboard/resumen",
      "/facturas?page=1&limit=20",
      "/inventario/resumen",
    ]),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Proveedor de la finca" }),
  );
  expect(router.push).toHaveBeenCalledWith("/facturas/factura-actual");
  await fireEvent.press(
    screen.getByRole("button", { name: "Registrar movimiento" }),
  );
  expect(router.push).toHaveBeenCalledWith("/movimiento");
});
test("ocultar balance también oculta ingresos y gastos; puede restaurarse", async () => {
  await render(<Home />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Ocultar balance" }),
  );
  expect(screen.getAllByText("••••••")).toHaveLength(3);
  await fireEvent.press(
    screen.getByRole("button", { name: "Mostrar balance" }),
  );
  expect(screen.queryByText("••••••")).toBeNull();
});
test("Inicio offline permite lectura e impide acciones de escritura", async () => {
  mockOffline = true;
  await render(<Home />);
  expect(screen.getByText("Datos almacenados localmente")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Registrar movimiento" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cargar XML" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Ver todas las facturas" }),
  ).not.toBeDisabled();
});

function ThemeProbe() {
  const { colors, reduceMotion, setMode } = useTheme();
  return (
    <>
      <Text testID="theme">{colors.bg + "|" + colors.onGreen}</Text>
      <Text testID="motion">{String(reduceMotion)}</Text>
      <Text onPress={() => setMode("dark")}>Elegir oscuro</Text>
    </>
  );
}
test("el tema conserva la preferencia y responde al movimiento reducido del dispositivo", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
  let listener: (value: boolean) => void = () => {};
  const remove = jest.fn();
  const subscription = jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation((event, callback) => {
      if (event === "reduceMotionChanged")
        listener = callback as (value: boolean) => void;
      return { remove };
    });
  const result = await render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("motion")).toHaveTextContent("false"),
  );
  await act(async () => listener(true));
  expect(screen.getByTestId("motion")).toHaveTextContent("true");
  await fireEvent.press(screen.getByText("Elegir oscuro"));
  expect(screen.getByTestId("theme")).toHaveTextContent("#252B1C|#262E16");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("cg.theme", "dark");
  await result.unmount();
  expect(remove).toHaveBeenCalled();
  subscription.mockRestore();
  jest.restoreAllMocks();
});
