// Thẻ nhắc kích hoạt Smart OTP trên trang chủ và Điểm thưởng (CONG_VIEC_72; QUYTAC_NGHIEPVU_571).
// Hiện khi khách chưa kích hoạt (hoặc đang dùng Smart OTP trên bản web) và còn thời hạn chuyển đổi; "Để sau" ẩn đến hết ngày.
import type { SmartOtpStatusResponse } from "contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, read, write } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { space } from "@/lib/theme";
import { Button, Notice } from "./ui";

const t = translator("vcommApp");
const dismissKey = "vcomm.smartOtpReminderDismissed";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const day = (value: string) => value.split("-").reverse().join("/");

export function SmartOtpReminder({ showActivate = true }: { showActivate?: boolean }) {
  const [status, setStatus] = useState<SmartOtpStatusResponse | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    Promise.all([api<SmartOtpStatusResponse>("/buyer/loyalty/smart-otp"), read(dismissKey)])
      .then(([loaded, stored]) => {
        setStatus(loaded);
        setDismissed(stored === today());
      })
      .catch(() => undefined);
  }, []);

  if (!status || dismissed || today() > status.transitionEndsOn) return null;
  if (status.active && status.platform !== "web") return null;
  const days = Math.round((Date.parse(`${status.transitionEndsOn}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000) + 1;
  return (
    <View style={{ gap: space[2] }}>
      <Notice tone="info" text={t(status.active ? "smartOtpReminderWeb" : "smartOtpReminder", { date: day(status.transitionEndsOn), days })} />
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {showActivate ? (
          <View style={{ flex: 1 }}>
            <Button label={t("smartOtpActivate")} onPress={() => router.push("/diem-thuong")} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            label={t("later")}
            kind="secondary"
            onPress={() => {
              setDismissed(true);
              void write(dismissKey, today());
            }}
          />
        </View>
      </View>
    </View>
  );
}
