"use client";

// MAN_HINH_161 Bán hàng tại quầy: chưa có ca thì mở ca (MAN_HINH_162), có ca thì màn hình bán.
import type { RetailCounterContext } from "contracts";
import { useTranslations } from "next-intl";
import { useAdmin } from "ui/components/AppShell";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { Counter } from "@/components/Counter";
import { OpenShiftForm } from "@/components/OpenShiftForm";

export default function CounterPage() {
  const t = useTranslations("retailShifts");
  const { notify } = useAdmin();
  const { state, reload } = useApi<RetailCounterContext>("/retail/counter");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(context) =>
        context.currentShift ? (
          <Counter shift={context.currentShift} onShiftChanged={() => void reload()} />
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
