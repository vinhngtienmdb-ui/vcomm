// MAN_HINH_276 Mã thanh toán (CONG_VIEC_73; QUYTAC_NGHIEPVU_574, 576; API_327).
// Mở Smart OTP (vân tay, khuôn mặt hoặc mã khóa) rồi hiện mã QR và mã vạch Code 128 của 18 chữ số, đổi mỗi 30 giây, không cần mạng.
// Trong lúc mở, ứng dụng hỏi máy chủ mỗi 2 giây: thu ngân quét xong thì hiện đơn đang chờ khách thanh toán.
import type { BuyerInstoreCheckout, SmartOtpStatusResponse } from "contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Rect } from "react-native-svg";
import { UnlockFlow } from "@/components/SmartOtpLock";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { code128C, groupPayCode, payCodeOf, payCodePrefix } from "@/lib/pay-code";
import { loadSmartOtp, type StoredSmartOtp } from "@/lib/smart-otp";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} đ`;
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

// Mã vạch Code 128 vẽ bằng SVG, có lề trắng hai bên để máy quét đọc được.
function Barcode({ digits, height = 72 }: { digits: string; height?: number }) {
  const widths = code128C(digits);
  const quiet = 10;
  const total = widths.reduce((sum, width) => sum + width, 0) + quiet * 2;
  let x = quiet;
  const bars = widths.map((width, index) => {
    const bar = index % 2 === 0 ? <Rect key={index} x={x} y={0} width={width} height={height} fill={colors.text} /> : null;
    x += width;
    return bar;
  });
  return (
    <View accessible accessibilityLabel={t("payCodeBarcode")} style={{ width: "100%", aspectRatio: total / height, backgroundColor: colors.surface }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none">
        {bars}
      </Svg>
    </View>
  );
}

export default function PayCodeScreen() {
  const [status, setStatus] = useState<SmartOtpStatusResponse | null>(null);
  const [stored, setStored] = useState<StoredSmartOtp | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState<StoredSmartOtp | null>(null);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [pending, setPending] = useState<BuyerInstoreCheckout[]>([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  useEffect(() => {
    Promise.all([api<SmartOtpStatusResponse>("/buyer/loyalty/smart-otp"), loadSmartOtp()])
      .then(([loaded, local]) => {
        setStatus(loaded);
        setStored(local);
      })
      .catch(fail);
  }, []);
  // Mã đổi theo bước 30 giây; đồng hồ chạy mỗi giây để thanh đếm ngược cập nhật.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unlock = useCallback(async (value: StoredSmartOtp) => {
    try {
      setPrefix(await payCodePrefix(value.activatedAt));
      setUnlocked(value);
    } catch (failure) {
      fail(failure);
    }
  }, []);

  // Đơn đang chờ khách: hỏi mỗi 2 giây khi đang hiện mã, dừng khi rời màn hình.
  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    const poll = () =>
      api<BuyerInstoreCheckout[]>("/buyer/instore/checkouts/pending")
        .then((rows) => active && setPending(rows))
        .catch(() => undefined);
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [unlocked]);

  if (stored === undefined && !error) return <Loading />;
  // Máy này giữ đúng khóa đang hiệu lực khi thời điểm kích hoạt khớp máy chủ (như MAN_HINH_151).
  const onThisDevice = Boolean(status?.active && stored && stored.activatedAt === status.activatedAt && stored.pin);
  const code = unlocked && prefix ? payCodeOf(prefix, unlocked.secret, now) : null;
  const secondsLeft = 30 - (Math.floor(now / 1000) % 30);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Title>{t("payCodeTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!onThisDevice ? (
          <Card>
            <Muted>{status?.active ? t("payCodeOtherDevice") : t("payCodeNeedsSmartOtp")}</Muted>
            <Button label={t("payCodeOpenSmartOtp")} onPress={() => router.push("/diem-thuong")} />
          </Card>
        ) : !code ? (
          <Card>
            <Muted>{t("payCodeUnlockHint")}</Muted>
            <UnlockFlow onUnlocked={(value) => void unlock(value)} onLockedOut={() => router.replace("/diem-thuong")} />
          </Card>
        ) : (
          <>
            {pending.map((checkout) => (
              <Card key={checkout.id}>
                <Notice tone="info" text={t("payCodeCheckoutWaiting", { store: checkout.storeName, place: checkout.placeName })} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text }}>{checkout.documentNo}</Text>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>{money(checkout.billAmount)}</Text>
                </View>
                <Muted>{t("payCodeCheckoutExpires", { time: time(checkout.expiresAt) })}</Muted>
              </Card>
            ))}
            <Card>
              <View style={{ alignItems: "center", gap: space[3] }}>
                <View accessible accessibilityLabel={t("payCodeQr")} style={{ padding: space[2], backgroundColor: colors.surface, borderRadius: radius.medium }}>
                  <QRCode value={code} size={200} />
                </View>
                <Barcode digits={code} />
                <Text selectable style={{ fontSize: 20, fontWeight: "800", letterSpacing: 1, color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {groupPayCode(code)}
                </Text>
                <View style={{ width: "100%", height: 6, borderRadius: radius.round, backgroundColor: colors.border, overflow: "hidden" }}>
                  <View style={{ width: `${(secondsLeft / 30) * 100}%`, height: "100%", backgroundColor: colors.primary }} />
                </View>
                <Muted>{t("payCodeRefresh", { seconds: secondsLeft })}</Muted>
              </View>
            </Card>
            <Notice tone="info" text={t("payCodeHint")} />
            {status?.redeemLockedUntil ? <Notice tone="warning" text={t("payCodeRedeemLocked", { time: time(status.redeemLockedUntil) })} /> : null}
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
