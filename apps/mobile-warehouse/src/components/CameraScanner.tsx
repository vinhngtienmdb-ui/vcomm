// Lớp quét bằng camera điện thoại (expo-camera): chỉ đọc mã, không lưu ảnh; xin quyền khi mở lần đầu.
// Sau mỗi mã dừng 1 giây để không đọc lặp cùng một mã.
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { Button, Muted, Notice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const barcodeTypes = ["code128", "ean13", "ean8", "upc_a", "upc_e", "code39", "qr", "datamatrix"] as const;

export function CameraScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const pausedUntil = useRef(0);

  const scanned = (result: BarcodeScanningResult) => {
    const now = Date.now();
    if (now < pausedUntil.current) return;
    pausedUntil.current = now + 1000;
    setLast(result.data);
    onScan(result.data.trim());
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.topBar, padding: space[4], gap: space[3] }}>
        <Text style={{ color: colors.surface, fontSize: 18, fontWeight: "700" }}>{t("cameraTitle")}</Text>
        {!permission ? null : !permission.granted ? (
          <View style={{ gap: space[3] }}>
            <Notice tone="info" text={t("cameraPermission")} />
            <Button label={t("cameraAllow")} onPress={() => void requestPermission()} />
          </View>
        ) : (
          <View style={{ flex: 1, borderRadius: radius.medium, overflow: "hidden" }}>
            <CameraView style={{ flex: 1 }} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: [...barcodeTypes] }} onBarcodeScanned={scanned} />
          </View>
        )}
        {last ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.small, padding: space[2] }}>
            <Muted>{t("cameraLast", { code: last })}</Muted>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {permission?.granted ? (
            <View style={{ flex: 1 }}>
              <Button label={torch ? t("torchOff") : t("torchOn")} kind="secondary" onPress={() => setTorch(!torch)} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={t("close")} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
