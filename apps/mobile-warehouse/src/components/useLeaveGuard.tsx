// Hỏi trước khi rời màn hình còn dữ liệu chưa gửi (QUYTAC_NGHIEPVU_281): nút quay lại trên thanh đầu và nút quay lại của Android.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler, Platform, View } from "react-native";
import { Button, Card, Notice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { space } from "@/lib/theme";

export function useLeaveGuard(dirty: boolean) {
  const [asking, setAsking] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/kho"));
  const requestLeave = () => (dirty ? setAsking(true) : leave());
  useFocusEffect(
    useCallback(() => {
      // Bản web không có nút quay lại phần cứng.
      if (Platform.OS === "web") return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!dirty) return false;
        setAsking(true);
        return true;
      });
      return () => subscription.remove();
    }, [dirty]),
  );
  const prompt = asking ? (
    <Card>
      <Notice tone="warning" text={t("leaveUnsaved")} />
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Button label={t("stay")} kind="secondary" onPress={() => setAsking(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t("leave")} onPress={leave} />
        </View>
      </View>
    </Card>
  ) : null;
  return { requestLeave, prompt };
}
