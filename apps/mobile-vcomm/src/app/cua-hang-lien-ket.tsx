// MAN_HINH_181 Cửa hàng liên kết trên ứng dụng VComm (CONG_VIEC_55; CHUC_NANG_194; API_209; QUYTAC_NGHIEPVU_395 đến 397):
// quét mã QR của cửa hàng rồi xác nhận, yêu cầu chờ xác nhận theo số điện thoại, mã thành viên cho thu ngân quét, lịch sử giao dịch.
import type { BuyerAffiliateRequest, BuyerAffiliateTransaction, BuyerMemberCode } from "contracts";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, Field, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const points = (value: number) => value.toLocaleString("vi-VN");

function ScanModal({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.topBar, padding: space[4], gap: space[3] }}>
        <Text style={{ color: colors.surface, fontSize: 18, fontWeight: "700" }}>{t("affiliateScanTitle")}</Text>
        {!permission ? null : !permission.granted ? (
          <View style={{ gap: space[3] }}>
            <Notice tone="info" text={t("affiliateCameraPermission")} />
            <Button label={t("affiliateCameraAllow")} onPress={() => void requestPermission()} />
          </View>
        ) : (
          <View style={{ flex: 1, borderRadius: radius.medium, overflow: "hidden" }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(result) => {
                if (done.current) return;
                done.current = true;
                onCode(result.data.trim());
              }}
            />
          </View>
        )}
        <Button label={t("close")} kind="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

// Xác nhận giao dịch: chọn số điểm dùng (0 đến tối đa), xem tiền phải trả.
function ConfirmCard({ request, code, onDone, onError }: { request: BuyerAffiliateRequest; code: string | null; onDone: (message: string) => void; onError: (failure: unknown) => void }) {
  const [value, setValue] = useState("0");
  const [busy, setBusy] = useState(false);
  const used = Math.min(Math.max(Number(value.replace(/\D/g, "")) || 0, 0), request.maxPoints);
  const amount = request.pointValue ? Math.floor(used * Number(request.pointValue)) : 0;
  async function send(action: "confirm" | "decline") {
    setBusy(true);
    try {
      await api(`/buyer/affiliate/transactions/${request.transactionId}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "confirm" ? { points: used, ...(code ? { code } : {}) } : code ? { code } : {}),
      });
      onDone(action === "confirm" ? t("affiliateConfirmed") : t("affiliateDeclined"));
    } catch (failure) {
      onError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>{request.merchantName}</Text>
      <Muted>{t("affiliateOutlet", { outlet: request.outletName, document: request.documentNo })}</Muted>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{money(request.billAmount)}</Text>
      {request.redeemable ? (
        <>
          <Muted>{t("affiliateRedeemHint", { balance: points(request.balance), max: points(request.maxPoints), min: points(request.minPoints) })}</Muted>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field label={t("affiliatePointsToUse")} keyboardType="number-pad" value={value} onChangeText={setValue} />
            </View>
            <Button label={t("affiliateUseMax")} kind="secondary" onPress={() => setValue(String(request.maxPoints))} />
          </View>
        </>
      ) : (
        <Muted>{t(`affiliateNoRedeem_${request.blockedReason ?? "insufficient"}`)}</Muted>
      )}
      <Text>{t("affiliatePointsAmount", { amount: money(amount) })}</Text>
      <Text style={{ fontWeight: "800" }}>{t("affiliateYouPay", { amount: money(Number(request.billAmount) - amount) })}</Text>
      <Muted>{t("affiliateEarnRate", { percent: request.earnPercent.replace(".", ",") })}</Muted>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Button label={t("affiliateDecline")} kind="secondary" busy={busy} onPress={() => void send("decline")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t("affiliateConfirm")} busy={busy} disabled={request.redeemable && used > 0 && used < request.minPoints} onPress={() => void send("confirm")} />
        </View>
      </View>
    </Card>
  );
}

function MemberCode({ onError }: { onError: (failure: unknown) => void }) {
  const [value, setValue] = useState("0");
  const [code, setCode] = useState<BuyerMemberCode | null>(null);
  const create = useCallback(async () => {
    try {
      setCode(await api<BuyerMemberCode>("/buyer/affiliate/member-code", { method: "POST", body: JSON.stringify({ points: Number(value.replace(/\D/g, "")) || 0 }) }));
    } catch (failure) {
      onError(failure);
    }
  }, [onError, value]);
  // Mã hết hạn sau 60 giây: tự tạo mã mới trước khi hết hạn khi đang mở.
  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => void create(), Math.max(new Date(code.expiresAt).getTime() - Date.now() - 5000, 1000));
    return () => clearTimeout(timer);
  }, [code, create]);
  return (
    <Card>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>{t("affiliateMemberCode")}</Text>
      <Muted>{t("affiliateMemberCodeHint")}</Muted>
      <Field label={t("affiliateAllowPoints")} keyboardType="number-pad" value={value} onChangeText={(text) => (setValue(text), setCode(null))} />
      {code ? (
        <View style={{ alignItems: "center", gap: space[2], paddingVertical: space[2] }}>
          <QRCode value={code.code} size={220} />
          <Muted>{t("affiliateCodeRefresh")}</Muted>
        </View>
      ) : (
        <Button label={t("affiliateShowCode")} onPress={() => void create()} />
      )}
    </Card>
  );
}

export default function AffiliateScreen() {
  const [pending, setPending] = useState<BuyerAffiliateRequest[]>([]);
  const [scanned, setScanned] = useState<{ request: BuyerAffiliateRequest; code: string } | null>(null);
  const [history, setHistory] = useState<BuyerAffiliateTransaction[]>([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const fail = useCallback((failure: unknown) => setMessage({ text: failure instanceof ApiFailure ? failure.message : t("unknownError"), tone: "error" }), []);
  const reload = useCallback(() => {
    Promise.all([api<BuyerAffiliateRequest[]>("/buyer/affiliate/pending"), api<BuyerAffiliateTransaction[]>("/buyer/affiliate/transactions")])
      .then(([requests, transactions]) => {
        setPending(requests);
        setHistory(transactions);
      })
      .catch(fail);
  }, [fail]);
  useFocusEffect(reload);
  const done = (text: string) => {
    setScanned(null);
    setMessage({ text, tone: "success" });
    reload();
  };
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/tai-khoan"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{t("affiliateTitle")}</Title>
        {message ? <Notice text={message.text} tone={message.tone} /> : null}
        {scanned ? <ConfirmCard request={scanned.request} code={scanned.code} onDone={done} onError={fail} /> : null}
        {pending.map((request) => (
          <ConfirmCard key={request.transactionId} request={request} code={null} onDone={done} onError={fail} />
        ))}
        <Button label={t("affiliateScanStore")} onPress={() => (setMessage(null), setScanning(true))} />
        <MemberCode onError={fail} />
        <Card>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{t("affiliateHistory")}</Text>
          {history.length === 0 ? <Muted>{t("affiliateNoHistory")}</Muted> : null}
          {history.map((item) => (
            <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[2], gap: space[1] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <Text style={{ fontWeight: "700", flex: 1 }}>{item.merchantName}</Text>
                <StatusBadge text={t(`affiliateStatus_${item.status}`)} tone={item.status === "completed" ? "success" : "warning"} />
              </View>
              <Muted>{`${shortDate(item.createdAt)} · ${item.outletName} · ${money(item.billAmount)}`}</Muted>
              <Muted>{t("affiliateHistoryPoints", { used: points(item.redeemedPoints), earned: points(item.earnedPoints) })}</Muted>
            </View>
          ))}
        </Card>
        {scanning ? (
          <ScanModal
            onClose={() => setScanning(false)}
            onCode={(code) => {
              setScanning(false);
              api<BuyerAffiliateRequest>("/buyer/affiliate/scan", { method: "POST", body: JSON.stringify({ code }) })
                .then((request) => setScanned({ request, code }))
                .catch(fail);
            }}
          />
        ) : null}
      </Screen>
    </ScrollView>
  );
}
