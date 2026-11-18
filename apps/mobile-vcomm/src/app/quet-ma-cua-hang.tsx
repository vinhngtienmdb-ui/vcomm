// Quét mã QR thanh toán của cửa hàng bằng camera (CONG_VIEC_73; QUYTAC_NGHIEPVU_577): đọc đường dẫn .../tt/<mã>, nhận đơn rồi mở MAN_HINH_277.
import type { BuyerInstoreCheckout } from "contracts";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Notice } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { checkoutToken } from "@/lib/pay-code";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");


export default function ScanStoreCodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  async function scanned(text: string) {
    if (busy.current) return;
    const token = checkoutToken(text.trim());
    if (!token) return setError(t("instoreNotStoreCode"));
    busy.current = true;
    try {
      const checkout = await api<BuyerInstoreCheckout>("/buyer/instore/checkouts/claim", { method: "POST", json: { token } });
      router.replace({ pathname: "/thanh-toan-cua-hang/[id]", params: { id: checkout.id } });
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      busy.current = false;
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.topBar, padding: space[4], gap: space[3] }}>
      <Text style={{ color: colors.surface, fontSize: 18, fontWeight: "700" }}>{t("instoreScanTitle")}</Text>
      {error ? <Notice text={error} /> : null}
      {!permission ? null : !permission.granted ? (
        <View style={{ gap: space[3] }}>
          <Notice tone="info" text={t("affiliateCameraPermission")} />
          <Button label={t("affiliateCameraAllow")} onPress={() => void requestPermission()} />
        </View>
      ) : (
        <View style={{ flex: 1, borderRadius: radius.medium, overflow: "hidden" }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={(result) => void scanned(result.data)} />
        </View>
      )}
      <Button label={t("close")} kind="secondary" onPress={() => router.back()} />
    </View>
  );
}
