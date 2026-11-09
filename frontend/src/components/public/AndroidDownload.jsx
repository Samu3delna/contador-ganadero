import { Download } from 'lucide-react';

export const ANDROID_APK_URL = 'https://github.com/Samu3delna/contador-ganadero/releases/download/mobile-v0.1.0/contador-ganadero-0.1.0-android-arm64.apk';

export default function AndroidDownload({ describedBy }) {
  return (
    <a className="cg-button cg-button-secondary" href={ANDROID_APK_URL} aria-describedby={describedBy}>
      <Download size={19} aria-hidden="true" /> Descargar APK para Android
    </a>
  );
}
