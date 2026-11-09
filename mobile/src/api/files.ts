import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "./client";
export async function uploadXml() {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/xml", "text/xml", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  try {
    const file = new File(asset.uri);
    const size = asset.size ?? file.size;
    if (
      !asset.name.toLowerCase().endsWith(".xml") ||
      !size ||
      size > 2 * 1024 * 1024
    )
      throw new Error("Selecciona un XML de hasta 2 MB.");
    const beginning = (await file.text()).trimStart();
    if (!beginning.startsWith("<") || /<!DOCTYPE|<!ENTITY/i.test(beginning))
      throw new Error("El archivo no es un XML admitido.");
    const body = new FormData();
    body.append("archivoXML", {
      uri: asset.uri,
      name: asset.name,
      type: "application/xml",
    } as unknown as Blob);
    const { data } = await api.post("/facturas/upload", body, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return data as { mensaje?: string; duplicada?: boolean };
  } finally {
    try {
      new File(asset.uri).delete();
    } catch {}
  }
}
export async function openInvoiceFile(id: string, extension: "xml" | "pdf") {
  const { data } = await api.get(
    "/facturas/" + encodeURIComponent(id) + "/" + extension,
    { responseType: "arraybuffer" },
  );
  const file = new File(Paths.cache, "factura-" + id + "." + extension);
  try {
    file.create({ overwrite: true });
    file.write(new Uint8Array(data));
    await Sharing.shareAsync(file.uri, {
      mimeType: extension === "pdf" ? "application/pdf" : "application/xml",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
