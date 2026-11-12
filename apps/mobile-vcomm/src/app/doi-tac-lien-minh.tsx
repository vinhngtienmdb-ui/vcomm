// MAN_HINH_264 Đối tác liên minh (CONG_VIEC_65; CHUC_NANG_237; API_306; QUYTAC_NGHIEPVU_541): danh sách đối tác đang hoạt động, liên kết số thành viên bằng mã OTP
// do đối tác gửi, hủy liên kết. Đổi điểm với đối tác (MAN_HINH_265) thêm ở lát L2.
import type { BuyerPartnerItem, BuyerPartnerLinkRequest } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("loyaltyPartnerApp");

function PartnerCard({ partner, onChanged }: { partner: BuyerPartnerItem; onChanged: (message: string) => void }) {
  const [memberNumber, setMemberNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [linking, setLinking] = useState(false);
  const [request, setRequest] = useState<BuyerPartnerLinkRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await work();
    } catch (failure) {
      if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) setFields(failure.fields);
      else setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  };
  const rate = (direction: "outbound" | "inbound") => {
    const value = partner[direction];
    return value ? t(`rate_${direction}`, { points: value.vcommPoints, units: value.partnerUnits, unit: partner.unitNameVi }) : null;
  };
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], alignItems: "center" }}>
        <Text style={{ fontWeight: "700", color: colors.text, flexShrink: 1 }}>{partner.partnerName}</Text>
        <StatusBadge text={partner.link ? t("linked") : t("notLinked")} tone={partner.link ? "success" : "neutral"} />
      </View>
      <Muted>{partner.programName}</Muted>
      {rate("outbound") ? <Muted>{rate("outbound")}</Muted> : null}
      {rate("inbound") ? <Muted>{rate("inbound")}</Muted> : null}
      {error ? <Notice text={error} /> : null}
      {partner.link ? (
        <>
          <Muted>{t("linkedAs", { member: partner.link.memberNumberMasked, name: partner.link.memberNameMasked ?? "" })}</Muted>
          <Button
            label={t("unlink")}
            kind="secondary"
            busy={busy}
            onPress={() =>
              void attempt(async () => {
                await api(`/buyer/loyalty/partners/${partner.id}/link`, { method: "DELETE" });
                onChanged(t("unlinked"));
              })
            }
          />
        </>
      ) : !linking ? (
        <Button label={t("link")} onPress={() => setLinking(true)} />
      ) : !request ? (
        <>
          <Field label={t("memberNumber", { program: partner.programName })} value={memberNumber} onChangeText={setMemberNumber} autoCapitalize="none" error={fields.memberNumber} />
          <Button
            label={t("sendCode")}
            busy={busy}
            disabled={!memberNumber.trim()}
            onPress={() =>
              void attempt(async () => {
                setRequest(await api<BuyerPartnerLinkRequest>(`/buyer/loyalty/partners/${partner.id}/link`, { method: "POST", json: { memberNumber: memberNumber.trim() } }));
              })
            }
          />
          <Button label={t("cancel")} kind="secondary" onPress={() => setLinking(false)} />
        </>
      ) : (
        <>
          <Notice tone="info" text={t("codeSent", { partner: partner.partnerName })} />
          <Field label={t("otp", { partner: partner.partnerName })} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} error={fields.otp} />
          <Muted>{t("otpHint")}</Muted>
          <Button
            label={t("confirmLink")}
            busy={busy}
            disabled={!otp.trim()}
            onPress={() =>
              void attempt(async () => {
                await api(`/buyer/loyalty/partner-links/${request.requestId}/verify`, { method: "POST", json: { otp: otp.trim() } });
                onChanged(t("linkedDone", { program: partner.programName }));
              })
            }
          />
          <Button
            label={t("cancel")}
            kind="secondary"
            onPress={() => {
              setRequest(null);
              setLinking(false);
            }}
          />
        </>
      )}
    </Card>
  );
}

export default function LoyaltyPartnersScreen() {
  const [partners, setPartners] = useState<BuyerPartnerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    api<BuyerPartnerItem[]>("/buyer/loyalty/partners")
      .then(setPartners)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, []);
  useFocusEffect(reload);
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/diem-thuong"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{t("title")}</Title>
        <Muted>{t("intro")}</Muted>
        {message ? <Notice tone="success" text={message} /> : null}
        {error ? <Notice text={error} /> : null}
        {!partners && !error ? <Loading /> : null}
        {partners && partners.length === 0 ? <Muted>{t("empty")}</Muted> : null}
        {partners?.map((partner) => (
          <PartnerCard
            key={`${partner.id}-${partner.link ? "linked" : "open"}`}
            partner={partner}
            onChanged={(text) => {
              setMessage(text);
              reload();
            }}
          />
        ))}
      </Screen>
    </ScrollView>
  );
}
