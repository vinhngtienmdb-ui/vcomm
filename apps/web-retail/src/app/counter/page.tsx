"use client";

// MAN_HINH_161 Bán hàng tại quầy. Lát L1: chưa có ca thì mở ca; có ca thì hiện ca đang mở (màn hình bán làm ở lát L2).
import type { RetailCounterContext } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAdmin } from "ui/components/AppShell";
import { Loaded } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { OpenShiftForm } from "@/components/OpenShiftForm";

export default function CounterPage() {
  const t = useTranslations("retailShifts");
  const { notify } = useAdmin();
  const { state, reload } = useApi<RetailCounterContext>("/retail/counter");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(context) =>
        context.currentShift ? (
          <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>{t("currentShift", { register: context.currentShift.register.code, time: formatDateTime(context.currentShift.openedAt) })}</h2>
            <div className="khoi-canh-bao thong-tin">{t("sellingLater")}</div>
            <div className="nhom-nut">
              <Link className="nut chinh" href={`/shifts/${context.currentShift.id}`}>
                {t("closeTitle")}
              </Link>
            </div>
          </div>
        ) : (
          <OpenShiftForm
            context={context}
            onOpened={() => {
              notify(t("opened"));
              void reload();
            }}
          />
        )
      }
    </Loaded>
  );
}
