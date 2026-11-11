// MAN_HINH_106 Trang kho (CHUC_NANG_159; API_15, API_63, API_64, API_65): chọn công ty, kho; quét tra tồn theo lô, vị trí; thao tác theo quyền.
// Giá vốn không hiện trên ứng dụng.
import type { PageResponse, StockDetailResponse, StockItemOption, StockRow, WarehouseResponse } from "contracts";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Header, HeaderButton } from "@/components/Header";
import { ScanInput } from "@/components/ScanInput";
import { Button, Card, Choice, Loading, Muted, Notice, OptionList, Screen, Title } from "@/components/ui";
import { api, failureText } from "@/lib/api";
import { quantity, shortDate, t } from "@/lib/i18n";
import { decide } from "@/lib/scan";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";
import { ActionGrid } from "@/components/ActionGrid";

type Lookup = { option: StockItemOption; ownerName: string; row: StockRow | undefined; details: StockDetailResponse };

export default function WarehouseHome() {
  const { me, workplace, chooseCompany, chooseWarehouse, logout } = useSession();
  const [choosing, setChoosing] = useState(workplace === null);
  const [warehouses, setWarehouses] = useState<WarehouseResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [candidates, setCandidates] = useState<{ owner: { companyId: string; companyName: string }; option: StockItemOption }[]>([]);
  const hasAccess = me?.permissions.includes("inventory.access") ?? false;

  useEffect(() => {
    if (!choosing || !hasAccess) return;
    setWarehouses(null);
    api<WarehouseResponse[]>("/inventory/warehouses")
      .then((items) => setWarehouses(items.filter((item) => item.canOperate && item.status === "active")))
      .catch((failure: unknown) => setError(failureText(failure)));
  }, [choosing, hasAccess, me?.currentCompanyId]);

  const show = async (owner: { companyId: string; companyName: string }, option: StockItemOption) => {
    const warehouseId = workplace!.warehouse.id;
    const [rows, details] = await Promise.all([
      api<PageResponse<StockRow>>(`/inventory/stock?warehouseId=${warehouseId}&companyId=${owner.companyId}&onlyInStock=false&search=${encodeURIComponent(option.sku)}`),
      api<StockDetailResponse>(`/inventory/stock/${option.variantId}/details?warehouseId=${warehouseId}&companyId=${owner.companyId}`),
    ]);
    setCandidates([]);
    setLookup({ option, ownerName: owner.companyName, row: rows.data.find((row) => row.variantId === option.variantId), details });
  };

  // Tra mã theo từng công ty chủ hàng được gửi vào kho.
  const scan = async (code: string) => {
    if (!workplace) return;
    setBusy(true);
    setError(null);
    setLookup(null);
    setCandidates([]);
    try {
      const found: { owner: { companyId: string; companyName: string }; option: StockItemOption }[] = [];
      for (const owner of workplace.warehouse.owners) {
        const options = await api<StockItemOption[]>(`/inventory/items?companyId=${owner.companyId}&search=${encodeURIComponent(code)}`);
        const decision = decide(code, options, false);
        if (decision.kind === "item") found.push({ owner, option: decision.option });
        if (decision.kind === "choose") found.push(...decision.options.map((option) => ({ owner, option })));
      }
      if (found.length === 0) setError(t("codeNotFound", { code }));
      else if (found.length === 1) await show(found[0]!.owner, found[0]!.option);
      else setCandidates(found);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <Loading />;
  const company = me.companies.find((item) => item.id === me.currentCompanyId);

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={workplace && !choosing ? workplace.warehouse.name : t("chooseWarehouse")}
        subtitle={`${company?.shortName ?? ""} · ${me.user.fullName}`}
        right={workplace && !choosing ? <HeaderButton label={t("changeWarehouse")} onPress={() => setChoosing(true)} /> : undefined}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          {error ? <Notice text={error} /> : null}
          {choosing || !workplace ? (
            <Card>
              {me.companies.length > 1 ? (
                <Choice
                  label={t("company")}
                  value={me.currentCompanyId}
                  options={me.companies.map((item) => ({ value: item.id, label: item.shortName }))}
                  onChange={(value) => void chooseCompany(value).catch((failure: unknown) => setError(failureText(failure)))}
                />
              ) : null}
              {!hasAccess ? (
                <Notice tone="warning" text={t("noWarehouseAccess")} />
              ) : warehouses === null ? (
                <Loading />
              ) : warehouses.length === 0 ? (
                <Notice tone="warning" text={t("noWarehouses")} />
              ) : (
                <Choice
                  label={t("warehouse")}
                  value={workplace?.warehouse.id ?? null}
                  options={warehouses.map((item) => ({ value: item.id, label: `${item.code} – ${item.name}` }))}
                  onChange={(value) =>
                    void chooseWarehouse(warehouses.find((item) => item.id === value) ?? null)
                      .then(() => setChoosing(false))
                      .catch((failure: unknown) => setError(failureText(failure)))
                  }
                />
              )}
              {workplace ? <Button label={t("close")} kind="secondary" onPress={() => setChoosing(false)} /> : null}
            </Card>
          ) : (
            <>
              <ScanInput placeholder={t("lookupPlaceholder")} onScan={(code) => void scan(code)} busy={busy} />
              {busy ? <Loading /> : null}
              {candidates.length > 0 ? (
                <Card>
                  <Muted>{t("chooseItem")}</Muted>
                  <OptionList
                    items={candidates}
                    label={(item) => `${item.option.sku} · ${item.option.productName} (${item.owner.companyName})`}
                    onPick={(item) => void show(item.owner, item.option).catch((failure: unknown) => setError(failureText(failure)))}
                  />
                </Card>
              ) : null}
              {lookup ? <StockCard lookup={lookup} /> : null}
              <ActionGrid />
            </>
          )}
          <Button label={t("logout")} kind="secondary" onPress={() => void logout()} />
        </Screen>
      </ScrollView>
    </View>
  );
}

function StockCard({ lookup }: { lookup: Lookup }) {
  const { option, row, details } = lookup;
  const unit = row?.baseUnitName ?? option.units.find((item) => item.unitId === option.baseUnitId)?.unitName ?? "";
  return (
    <Card>
      <Title>{option.productName}</Title>
      <Muted>{[option.sku, ...option.optionValues, t("owner", { name: lookup.ownerName }), t("baseUnit", { unit })].join(" · ")}</Muted>
      <Text style={{ color: colors.text }}>{t("stockSummary", { onHand: quantity(row?.onHand ?? 0), reserved: quantity(row?.reserved ?? 0), available: quantity(row?.available ?? 0) })}</Text>
      {details.balances.length === 0 ? <Muted>{t("noStock")}</Muted> : null}
      {details.balances.map((balance, index) => (
        <View key={index} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2], gap: space[1] }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>
            {[
              balance.lotNo ? t("lotLine", { lot: balance.lotNo, expires: balance.expiresOn ? shortDate(balance.expiresOn) : "—" }) : null,
              balance.locationCode ? t("locationLine", { code: balance.locationCode }) : null,
            ]
              .filter(Boolean)
              .join(" · ") || t("noLot")}
          </Text>
          <Muted>{`${quantity(balance.quantity)} ${unit}`}</Muted>
        </View>
      ))}
      {details.serials.length > 0 ? <Muted>{t("serialList", { serials: details.serials.map((serial) => serial.serialNo).join(", ") })}</Muted> : null}
    </Card>
  );
}
