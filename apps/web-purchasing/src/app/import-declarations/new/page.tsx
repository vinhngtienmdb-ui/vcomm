"use client";

// MAN_HINH_110 Lập tờ khai (CHUC_NANG_160): chọn đơn mua nhập khẩu đã duyệt, rồi soạn tờ khai.
import type { ImportOrderOption } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { DeclarationEditor } from "@/components/DeclarationEditor";

export default function NewImportDeclarationPage() {
  const t = useTranslations("importDeclarations");
  const router = useRouter();
  const { notify } = useAdmin();
  const { state, reload } = useApi<ImportOrderOption[]>("/purchasing/import-orders");
  const [orderId, setOrderId] = useState("");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("add")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(orders) => {
          if (orders.length === 0) return <MessageView text={t("noOrders")} />;
          const order = orders.find((item) => item.id === orderId);
          return (
            <>
              <section className="the">
                <Field id="don-nhap-khau" label={`${t("order")} *`} hint={t("orderHint")}>
                  <select id="don-nhap-khau" className="o-nhap" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                    <option value="">{t("chooseOrder")}</option>
                    {orders.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.documentNo} · {item.supplierName} · {item.currency}
                      </option>
                    ))}
                  </select>
                </Field>
              </section>
              {order && (
                <DeclarationEditor
                  key={order.id}
                  order={order}
                  declaration={null}
                  onCancel={() => router.back()}
                  onSaved={(saved) => {
                    notify(t("saved"));
                    router.push(`/import-declarations/${saved.id}`);
                  }}
                />
              )}
            </>
          );
        }}
      </Loaded>
    </>
  );
}
