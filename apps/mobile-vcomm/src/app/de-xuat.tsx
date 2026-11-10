// MAN_HINH_85 Đề xuất thay đổi đội (CHUC_NANG_112; API_121; QUYTAC_NGHIEPVU_153): người quản lý lập đề xuất trong nhánh, xem, rút đề xuất của mình.
import type { SalesProposalItem, SalesProposalKind, SalesProposalOptionsResponse } from "contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAction } from "@/components/auth";
import { Button, Card, Choice, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const kinds: SalesProposalKind[] = ["add", "move", "appoint", "remove"];
const tone = { pending: "warning", approved: "success", rejected: "error", withdrawn: "neutral" } as const;

export default function ProposalsScreen() {
  const [options, setOptions] = useState<SalesProposalOptionsResponse | null>(null);
  const [proposals, setProposals] = useState<SalesProposalItem[] | null>(null);
  const [kind, setKind] = useState<SalesProposalKind>("add");
  const [phone, setPhone] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, fields, run } = useAction(["targetPhone", "targetUserId", "departmentId", "reason"]);

  const load = useCallback(async () => {
    const [loadedOptions, loadedProposals] = await Promise.all([api<SalesProposalOptionsResponse>("/buyer/sales/proposal-options"), api<SalesProposalItem[]>("/buyer/sales/proposals")]);
    setOptions(loadedOptions);
    setProposals(loadedProposals);
  }, []);
  useEffect(() => {
    void run(load);
  }, [run, load]);

  const member = options?.members.find((candidate) => candidate.userId === memberId);
  const needsUnit = kind === "add" || kind === "move";
  const departmentId = kind === "appoint" ? (member?.departmentId ?? null) : unitId;
  const ready = reason.trim() && (kind === "add" ? phone.trim() && unitId : memberId && (!needsUnit || unitId));

  const submit = () =>
    run(async () => {
      setSent(false);
      await api("/buyer/sales/proposals", {
        method: "POST",
        json: {
          kind,
          reason: reason.trim(),
          ...(kind === "add" ? { targetPhone: phone.trim() } : { targetUserId: memberId }),
          ...(kind === "remove" ? {} : { departmentId }),
        },
      });
      setSent(true);
      setPhone("");
      setReason("");
      setMemberId(null);
      setUnitId(null);
      await load();
    });

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("proposals")}</Title>
        {!options && !error ? <Loading /> : null}
        {error ? <Notice text={error} /> : null}
        {sent ? <Notice tone="success" text={t("proposalSent")} /> : null}
        {options ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("newProposal")}</Text>
            <Choice<SalesProposalKind> label={t("proposalKind")} value={kind} options={kinds.map((value) => ({ value, label: t(`kind_${value}`) }))} onChange={setKind} />
            {kind === "add" ? (
              <Field label={t("targetPhone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={15} error={fields.targetPhone} />
            ) : (
              <Choice<string>
                label={t("member")}
                value={memberId}
                options={options.members.map((candidate) => ({ value: candidate.userId, label: `${candidate.fullName} · ${t(`title_${candidate.title}`)}` }))}
                onChange={setMemberId}
              />
            )}
            {needsUnit ? <Choice<string> label={t("unit")} value={unitId} options={options.units.map((unit) => ({ value: unit.id, label: unit.name }))} onChange={setUnitId} /> : null}
            {fields.targetUserId || fields.departmentId ? <Notice text={fields.targetUserId ?? fields.departmentId ?? ""} /> : null}
            <Field label={t("reason")} value={reason} onChangeText={setReason} maxLength={500} multiline error={fields.reason} />
            <Button label={t("submitProposal")} busy={busy} disabled={!ready} onPress={() => void submit()} />
          </Card>
        ) : null}
        {proposals ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("myProposals")}</Text>
            {proposals.length === 0 ? <Muted>{t("noProposals")}</Muted> : null}
            {proposals.map((proposal, index) => (
              <View key={proposal.id} style={{ gap: space[1], borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}>
                <StatusBadge text={t(`status_${proposal.status}`)} tone={tone[proposal.status]} />
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {t(`kind_${proposal.kind}`)}: {proposal.targetName}
                  {proposal.departmentName ? ` → ${proposal.departmentName}` : ""}
                </Text>
                <Muted>
                  {proposal.reason} · {shortDate(proposal.createdAt)}
                </Muted>
                {proposal.decisionNote ? <Muted>{proposal.decisionNote}</Muted> : null}
                {proposal.status === "pending" ? (
                  <Button
                    label={t("withdraw")}
                    kind="secondary"
                    onPress={() => void run(async () => (await api(`/buyer/sales/proposals/${proposal.id}/withdraw`, { method: "POST" }), await load()))}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
