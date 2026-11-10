// MAN_HINH_71 Lịch sử ghé thăm trên ứng dụng (CHUC_NANG_103; API_114; QUYTAC_NGHIEPVU_139): của tôi hoặc của phòng mình quản lý.
import type { PageResponse, VisitItem } from "contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Loading, Muted, Notice } from "@/components/ui";
import { VisitCard } from "@/components/VisitCard";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

export default function VisitsScreen() {
  const t = translator("salesApp");
  const [items, setItems] = useState<VisitItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems((await api<PageResponse<VisitItem>>("/crm/visits?pageSize=50")).data);
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {error ? (
        <View style={{ padding: space[4] }}>
          <Notice text={error} />
        </View>
      ) : null}
      {items === null ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space[4], gap: space[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
          ListHeaderComponent={<Muted>{t("visitHint")}</Muted>}
          ListEmptyComponent={<Muted>{t("noVisits")}</Muted>}
          renderItem={({ item }) => <VisitCard visit={item} showCustomer />}
        />
      )}
    </View>
  );
}
