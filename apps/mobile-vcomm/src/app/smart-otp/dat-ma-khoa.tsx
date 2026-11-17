// MAN_HINH_269 Đặt mã khóa Smart OTP ngay sau khi đăng ký kèm kích hoạt Smart OTP (CONG_VIEC_72; QUYTAC_NGHIEPVU_562, 563).
import { router } from "expo-router";
import { SetPinFlow } from "@/components/SmartOtpLock";
import { Card, Screen, Title } from "@/components/ui";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function SetSmartOtpPinScreen() {
  const t = translator("vcommApp");
  const { me } = useSession();
  return (
    <Screen>
      <Title>{t("smartOtpPinTitle")}</Title>
      <Card>
        <SetPinFlow phone={me?.phone ?? null} onDone={() => router.replace("/")} />
      </Card>
    </Screen>
  );
}
