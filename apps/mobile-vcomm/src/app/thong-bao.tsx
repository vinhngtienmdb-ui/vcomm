// MAN_HINH_200 Thông báo (CHUC_NANG_205; API_48; QUYTAC_NGHIEPVU_438): 30 thông báo mới nhất của chính mình, chưa đọc in đậm;
// bấm thì đánh dấu đã đọc và mở liên kết nếu là màn hình của ứng dụng (bắt đầu bằng "/" và không phải đường dẫn web quản trị).
import type { NotificationItem, NotificationListResponse } from "contracts";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
// Màn hình của ứng dụng VComm mà thông báo được phép mở.
const appLinks = ["/hen", "/khach/", "/don-hang/", "/vi-hoa-hong", "/de-xuat", "/rut-tien"];
const isAppLink = (link: string | null): link is string => !!link && appLinks.some((prefix) => link === prefix || link.startsWith(prefix));
const timeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => `${timeFormat.format(new Date(iso))} · ${shortDate(iso)}`;

export default function NotificationsScreen() {
  const [data, setData] = useState<NotificationListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api<NotificationListResponse>("/notifications")
        .then((loaded) => active && setData(loaded))
        .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
      return () => {
        active = false;
      };
    }, []),
  );

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      await api(`/notifications/${item.id}/read`, { method: "POST" }).catch(() => undefined);
      setData((current) =>
        current ? { unreadCount: Math.max(0, current.unreadCount - 1), data: current.data.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)) } : current,
      );
    }
    if (isAppLink(item.link)) router.push(item.link as Href);
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("notificationsTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!data && !error ? <Loading /> : null}
        {data ? (
          <Card>
            <Muted>{t("notificationsUnread", { count: data.unreadCount })}</Muted>
            {data.data.length === 0 ? <Muted>{t("noNotifications")}</Muted> : null}
            {data.data.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => void open(item)}
                style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: item.readAt ? "400" : "700" }}>{item.title}</Text>
                  <Muted>{when(item.createdAt)}</Muted>
                </View>
                {item.readAt ? null : <StatusBadge text={t("notificationNew")} tone="info" />}
              </Pressable>
            ))}
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
