// Lối vào mục Thông báo trên thanh tiêu đề, kèm số chưa đọc (MAN_HINH_200; API_48; QUYTAC_NGHIEPVU_438). Tải lại khi đổi màn hình.
import type { NotificationListResponse } from "contracts";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export function NotificationBell() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    api<NotificationListResponse>("/notifications")
      .then((loaded) => active && setUnread(loaded.unreadCount))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={unread > 0 ? t("notificationsUnread", { count: unread }) : t("notificationsTitle")}
      onPress={() => router.push("/thong-bao")}
      style={{ flexDirection: "row", alignItems: "center", gap: space[1], paddingHorizontal: space[3], paddingVertical: space[2] }}
    >
      <Text style={{ color: colors.surface, fontWeight: "600" }}>{t("notificationsTitle")}</Text>
      {unread > 0 ? (
        <View style={{ minWidth: space[5], paddingHorizontal: space[1], borderRadius: radius.round, backgroundColor: colors.error, alignItems: "center" }}>
          <Text style={{ color: colors.surface, fontSize: 12, fontWeight: "700" }}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
