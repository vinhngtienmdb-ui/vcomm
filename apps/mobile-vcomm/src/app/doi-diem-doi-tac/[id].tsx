// MAN_HINH_265 Đổi điểm với đối tác (CONG_VIEC_65; CHUC_NANG_237; API_307; QUYTAC_NGHIEPVU_539, 540, 542 đến 544): chọn chiều, nhập số đơn vị đối tác (bội số),
// xem số điểm VComm tương ứng và giới hạn còn lại; đổi ra cần Smart OTP khi đã kích hoạt; đổi vào cần OTP do đối tác gửi; lịch sử đổi.
import type { BuyerPartnerExchange, BuyerPartnerExchangeQuote, BuyerPartnerItem, PageResponse, PartnerExchangeDirection } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("loyaltyPartnerApp");
const number = (value: number) => value.toLocaleString("vi-VN");
const tone = (status: BuyerPartnerExchange["status"]) =>
  status === "completed" ? "success" : status === "pending_partner" || status === "needs_review" || status === "otp_pending" || status === "sending" ? "warning" : "neutral";

export default function PartnerExchangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [partner, setPartner] = useState<BuyerPartnerItem | null>(null);
  const [history, setHistory] = useState<BuyerPartnerExchange[]>([]);
  const [direction, setDirection] = useState<PartnerExchangeDirection>("outbound");
  const [units, setUnits] = useState("");
  const [quote, setQuote] = useState<BuyerPartnerExchangeQuote | null>(null);
  const [smartOtp, setSmartOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [inbound, setInbound] = useState<BuyerPartnerExchange | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const fail = (failure: unknown) => {
    if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) setFields(failure.fields);
    else setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
  };

  const reload = useCallback(() => {
    setError(null);
    Promise.all([api<BuyerPartnerItem[]>("/buyer/loyalty/partners"), api<PageResponse<BuyerPartnerExchange>>("/buyer/loyalty/partner-exchanges?pageSize=50")])
      .then(([partners, exchanges]) => {
        const found = partners.find((item) => item.id === id) ?? null;
        setPartner(found);
        setHistory(exchanges.data.filter((item) => item.contractId === id));
        if (found && !found.outbound && found.inbound) setDirection("inbound");
      })
      .catch(fail);
  }, [id]);
  useFocusEffect(reload);

  const amount = Number(units.replace(/[.\s]/g, ""));
  // Báo giá khi đổi số đơn vị hoặc chiều (QUYTAC_NGHIEPVU_540: giới hạn còn lại).
  useEffect(() => {
    setQuote(null);
    setFields({});
    if (!partner || !Number.isInteger(amount) || amount <= 0) return;
    const timer = setTimeout(() => {
      api<BuyerPartnerExchangeQuote>("/buyer/loyalty/partner-exchanges/quote", { method: "POST", json: { contractId: id, direction, partnerUnits: amount } }).then(setQuote, fail);
    }, 300);
    return () => clearTimeout(timer);
  }, [amount, direction, id, partner]);

  async function attempt(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setFields({});
    setMessage(null);
    try {
      await work();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const unit = partner?.unitNameVi ?? "";
  const rate = partner ? partner[direction] : null;
  const summary = (item: BuyerPartnerExchange) =>
    item.direction === "outbound" ? t("historyOut", { units: number(item.partnerUnits), unit }) : t("historyIn", { units: number(item.partnerUnits), unit });
  const limit = (value: number | null) => (value === null ? t("noLimit") : t("pointsValue", { points: number(value) }));

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/doi-tac-lien-minh"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{partner ? t("exchangeTitle", { partner: partner.partnerName }) : t("exchange")}</Title>
        {message ? <Notice tone="success" text={message} /> : null}
        {error ? <Notice text={error} /> : null}
        {!partner && !error ? <Loading /> : null}
        {partner && !partner.link ? <Notice tone="info" text={t("notLinked")} /> : null}
        {partner?.link ? (
          <>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              {(["outbound", "inbound"] as const)
                .filter((value) => partner[value])
                .map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: direction === value }}
                    onPress={() => {
                      setDirection(value);
                      setInbound(null);
                    }}
                    style={{
                      paddingVertical: space[2],
                      paddingHorizontal: space[3],
                      borderRadius: radius.medium,
                      backgroundColor: direction === value ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: direction === value ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: direction === value ? "#FFFFFF" : colors.text, fontWeight: "700" }}>{t(`tab_${value}`, { unit })}</Text>
                  </Pressable>
                ))}
            </View>
            {rate ? (
              <Card>
                <Muted>{t(`rateLine_${direction}`, { points: number(rate.vcommPoints), units: number(rate.partnerUnits), unit, step: number(rate.partnerUnits) })}</Muted>
                <Field
                  label={t(direction === "outbound" ? "unitsOut" : "unitsIn", { unit })}
                  value={units}
                  onChangeText={setUnits}
                  keyboardType="number-pad"
                  error={fields.partnerUnits}
                  editable={!inbound}
                />
                {quote ? (
                  <View style={{ gap: space[1] }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.text }}>{t(direction === "outbound" ? "pointsDeducted" : "pointsReceived")}</Text>
                      <Text style={{ color: direction === "outbound" ? colors.error : colors.success, fontWeight: "700" }}>
                        {`${direction === "outbound" ? "−" : "+"}${t("pointsValue", { points: number(quote.vcommPoints) })}`}
                      </Text>
                    </View>
                    {quote.availablePoints !== null ? <Muted>{`${t("available")}: ${t("pointsValue", { points: number(quote.availablePoints) })}`}</Muted> : null}
                    <Muted>{`${t("remainingToday")}: ${limit(quote.remainingToday)}`}</Muted>
                    <Muted>{`${t("remainingMonth")}: ${limit(quote.remainingThisMonth)}`}</Muted>
                  </View>
                ) : null}
                {direction === "outbound" ? (
                  <>
                    {quote?.smartOtpRequired ? (
                      <>
                        <Field label={t("smartOtp")} value={smartOtp} onChangeText={setSmartOtp} keyboardType="number-pad" maxLength={6} error={fields.smartOtp} />
                        <Muted>{t("smartOtpHint")}</Muted>
                      </>
                    ) : null}
                    <Button
                      label={quote ? t("submitOut", { points: number(quote.vcommPoints), units: number(amount), unit }) : t("exchange")}
                      busy={busy}
                      disabled={!quote}
                      onPress={() =>
                        void attempt(async () => {
                          const done = await api<BuyerPartnerExchange>("/buyer/loyalty/partner-exchanges", {
                            method: "POST",
                            json: { contractId: id, direction: "outbound", partnerUnits: amount, ...(quote?.smartOtpRequired ? { smartOtp } : {}) },
                          });
                          setMessage(
                            done.status === "completed"
                              ? t("doneOut", { points: number(done.vcommPoints), units: number(done.partnerUnits), unit })
                              : done.status === "pending_partner"
                                ? t("pendingOut", { partner: partner.partnerName })
                                : t(`status_${done.status}`),
                          );
                          setUnits("");
                          setSmartOtp("");
                          reload();
                        })
                      }
                    />
                  </>
                ) : !inbound ? (
                  <Button
                    label={t("requestOtp", { partner: partner.partnerName })}
                    kind="secondary"
                    busy={busy}
                    disabled={!quote}
                    onPress={() =>
                      void attempt(async () => {
                        setInbound(await api<BuyerPartnerExchange>("/buyer/loyalty/partner-exchanges", { method: "POST", json: { contractId: id, direction: "inbound", partnerUnits: amount } }));
                      })
                    }
                  />
                ) : (
                  <>
                    <Notice tone="info" text={t("otpSent", { partner: partner.partnerName })} />
                    <Field label={t("partnerOtp", { partner: partner.partnerName })} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} error={fields.otp} />
                    <Button
                      label={t("confirmIn")}
                      busy={busy}
                      disabled={!otp.trim()}
                      onPress={() =>
                        void attempt(async () => {
                          const done = await api<BuyerPartnerExchange>(`/buyer/loyalty/partner-exchanges/${inbound.id}/otp`, { method: "POST", json: { otp: otp.trim() } });
                          setMessage(done.status === "completed" ? t("doneIn", { points: number(done.vcommPoints) }) : t(`status_${done.status}`));
                          setInbound(null);
                          setOtp("");
                          setUnits("");
                          reload();
                        })
                      }
                    />
                    <Button label={t("cancel")} kind="secondary" onPress={() => setInbound(null)} />
                  </>
                )}
              </Card>
            ) : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("history")}</Text>
              {history.length === 0 ? <Muted>{t("historyEmpty")}</Muted> : null}
              {history.map((item) => (
                <View key={item.id} style={{ gap: space[1], borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1 }}>{summary(item)}</Text>
                    <StatusBadge text={t(`status_${item.status}`)} tone={tone(item.status)} />
                  </View>
                  <Muted>{`${item.direction === "outbound" ? "−" : "+"}${t("pointsValue", { points: number(item.vcommPoints) })} · ${item.documentNo} · ${shortDate(item.createdAt)}`}</Muted>
                  {item.status === "pending_partner" || item.status === "needs_review" ? <Muted>{t("pendingNote", { partner: item.partnerName })}</Muted> : null}
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
