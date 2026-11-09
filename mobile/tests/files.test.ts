import * as Picker from "expo-document-picker";
import { api } from "../src/api/client";
import { uploadXml } from "../src/api/files";
const mockDelete = jest.fn();
const mockText = jest.fn();
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({
  File: jest
    .fn()
    .mockImplementation(() => ({ text: mockText, delete: mockDelete, size:100 })),
  Paths: { cache: "cache" },
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));
jest.mock("../src/api/client", () => ({ api: { post: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  (Picker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [
      { name: "factura.xml", size: 100, uri: "file:///cache/invoice.xml" },
    ],
  });
  mockText.mockResolvedValue("<FacturaElectronica/>");
  (api.post as jest.Mock).mockResolvedValue({ data: { duplicada: true } });
});
test("XML viaja como archivoXML y borra la copia temporal", async () => {
  expect(await uploadXml()).toEqual({ duplicada: true });
  expect(api.post).toHaveBeenCalledWith(
    "/facturas/upload",
    expect.any(FormData),
    expect.objectContaining({ timeout: 60000 }),
  );
  expect(mockDelete).toHaveBeenCalledTimes(1);
  (Picker.getDocumentAsync as jest.Mock).mockResolvedValue({canceled:false,assets:[{name:'factura.xml',uri:'file:///cache/invoice.xml'}]});
  expect(await uploadXml()).toEqual({duplicada:true});
});
test("una foto nunca se envía ni se anuncia como registrada", async () => {
  (Picker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ name: "foto.jpg", size: 100, uri: "file:///cache/photo.jpg" }],
  });
  await expect(uploadXml()).rejects.toThrow("XML");
  expect(api.post).not.toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalled();
});
test("rechaza entidades XML y elimina archivos incluso ante errores", async () => {
  mockText.mockResolvedValue("<!DOCTYPE invoice>");
  await expect(uploadXml()).rejects.toThrow("XML admitido");
  expect(api.post).not.toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalled();
});
test("cancelación del selector no registra datos", async () => {
  (Picker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
  expect(await uploadXml()).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
