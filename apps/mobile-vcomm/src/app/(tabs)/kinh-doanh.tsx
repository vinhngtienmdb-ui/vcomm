// MAN_HINH_78 Kinh doanh, MAN_HINH_83 Đội của tôi (CHUC_NANG_108, 111, 136; API_118, 122, 135; QUYTAC_NGHIEPVU_145, 149 đến 151, 203):
// chức danh, đơn vị của tôi; khách tôi phụ trách; người quản lý xem cấp dưới trong nhánh và hoa hồng của từng người.
// CONG_VIEC_22: thẻ Hẹn chăm sóc (MAN_HINH_198), Doanh số tháng này (MAN_HINH_199); bấm khách mở chi tiết khách MAN_HINH_196.
import type { BuyerSalesCustomerItem, FollowUpsResponse, MySalesTeamResponse, SalesRevenueResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { CustomerList } from "@/components/CustomerList";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function SalesScreen() {
  const [customers, setCustomers] = useState<BuyerSalesCustomerItem[] | null>(null);
  const [team, setTeam] = useState<MySalesTeamResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpsResponse | null>(null);
  const [revenue, setRevenue] = useState<SalesRevenueResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Tải riêng khách và đội: lỗi của phần này không che phần kia; bị bỏ đánh dấu (403) thì xóa dữ liệu cũ.
      const fail = (failure: unknown) => {
        if (!active) return;
        setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
        if (failure instanceof ApiFailure && failure.status === 403) {
          setCustomers(null);
          setTeam(null);
        }
      };
      setError(null);
      api<BuyerSalesCustomerItem[]>("/buyer/sales/customers")
        .then((items) => active && setCustomers(items))
        .catch(fail);
      // Thẻ hẹn hôm nay, quá hạn (MAN_HINH_198); lỗi không chặn phần còn lại.
      api<FollowUpsResponse>("/buyer/sales/follow-ups")
        .then((loaded) => active && setFollowUps(loaded))
        .catch(() => undefined);
      api<SalesRevenueResponse>("/buyer/sales/revenue")
        .then((loaded) => active && setRevenue(loaded))
        .catch(() => undefined);
      api<MySalesTeamResponse>("/buyer/sales/team")
        .then((loaded) => active && setTeam(loaded))
        .catch(fail);
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        {error ? <Notice text={error} /> : null}
        {!team && !error ? <Loading /> : null}
        {team ? (
          <Card>
            <Title>{t(`title_${team.title}`)}</Title>
            <Muted>{team.unitName}</Muted>
          </Card>
        ) : null}
        {followUps ? (
          <Pressable accessibilityRole="link" onPress={() => router.push("/hen")}>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("followUpsTitle")}</Text>
              <Muted>{t("followUpSummary", { today: followUps.dueToday.length, overdue: followUps.overdue.length, upcoming: followUps.upcoming.length })}</Muted>
            </Card>
          </Pressable>
        ) : null}
        {revenue ? (
          <Pressable accessibilityRole="link" onPress={() => router.push("/doanh-so")}>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("revenueThisMonth")}</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "700" }}>{money(revenue.me.completedAmount)}</Text>
              <Muted>{t("revenueCompletedHint", { orders: revenue.me.completedOrderCount, customers: revenue.me.customerCount })}</Muted>
            </Card>
          </Pressable>
        ) : null}
        {customers ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("salesCustomers")}</Text>
            <Muted>{t("customerCount", { count: customers.length })}</Muted>
            <CustomerList customers={customers} />
          </Card>
        ) : null}
        {team && team.title !== "staff" ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("myTeam", { count: team.members.length })}</Text>
            <Button label={t("proposals")} kind="secondary" onPress={() => router.push("/de-xuat")} />
            {team.members.length === 0 ? <Muted>{t("noTeam")}</Muted> : null}
            {team.members.map((member, index) => (
              <Pressable
                key={member.userId}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: "/doi/[id]", params: { id: member.userId, ten: member.fullName } })}
                style={{ borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
              >
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{member.fullName}</Text>
                <Muted>
                  {t(`title_${member.title}`)} · {member.unitName} · {t("customerCount", { count: member.customerCount })}
                </Muted>
                <Muted>{t("memberCommission", { credited: money(member.creditedCommission), pending: money(member.pendingCommission) })}</Muted>
              </Pressable>
            ))}
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
