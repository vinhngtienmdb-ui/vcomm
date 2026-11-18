// MAN_HINH_272 Thiết bị đã đăng nhập (CONG_VIEC_72; QUYTAC_NGHIEPVU_564; API_321): máy tin cậy, máy đang giữ Smart OTP; gỡ thiết bị đăng xuất thiết bị đó.
import type { BuyerDeviceItem } from "contracts";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

function confirm(text: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(text) ?? true);
  return new Promise((resolve) =>
    Alert.alert(t("confirmTitle"), text, [
      { text: t("cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("confirm"), style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function DevicesScreen() {
  const [devices, setDevices] = useState<BuyerDeviceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  const load = useCallback(() => {
    api<BuyerDeviceItem[]>("/buyer/devices").then(setDevices).catch(fail);
  }, []);
  useEffect(load, [load]);

  async function remove(item: BuyerDeviceItem) {
    if (!(await confirm(t("devicesRemoveConfirm", { device: item.deviceName ?? t("devicesUnknown") })))) return;
    setBusy(item.id);
    setError(null);
    try {
      setDevices(await api<BuyerDeviceItem[]>(`/buyer/devices/${item.id}`, { method: "DELETE" }));
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space[3], paddingBottom: space[6] }}>
        <Title>{t("devicesTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {devices === null ? (
          <Loading />
        ) : (
          <Card>
            {devices.map((item) => (
              <View key={item.id} style={{ gap: space[1], paddingBottom: space[2], borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
                  <Text style={{ fontWeight: "700", color: colors.text, flexShrink: 1 }}>{item.deviceName ?? t("devicesUnknown")}</Text>
                  {item.thisDevice ? <StatusBadge text={t("devicesThis")} tone="success" /> : null}
                </View>
                {item.holdsSmartOtp ? <Muted>{t("devicesHoldsSmartOtp")}</Muted> : null}
                <Muted>{t("devicesSeen", { first: time(item.firstSeenAt), last: time(item.lastSeenAt) })}</Muted>
                {!item.thisDevice ? <Button label={t("devicesRemove")} kind="secondary" busy={busy === item.id} onPress={() => void remove(item)} /> : null}
              </View>
            ))}
            <Muted>{t("devicesHint")}</Muted>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
