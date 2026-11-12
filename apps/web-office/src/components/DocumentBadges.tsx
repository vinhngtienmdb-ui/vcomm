"use client";

// Nhãn trạng thái, độ khẩn của công văn.
import type { DocumentUrgency, IncomingStatus, OutgoingStatus } from "contracts";
import { useTranslations } from "next-intl";

const incomingTone: Record<IncomingStatus, string> = {
  awaiting_registration: "canh-bao",
  registered: "thong-tin",
  awaiting_direction: "canh-bao",
  processing: "thong-tin",
  processed: "thanh-cong",
  archived: "trung-tinh",
  voided: "trung-tinh",
};
const outgoingTone: Record<OutgoingStatus, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  rejected: "loi",
  withdrawn: "trung-tinh",
  awaiting_number: "canh-bao",
  numbered: "thong-tin",
  issued: "thanh-cong",
  cancelled: "trung-tinh",
};

export function IncomingStatusBadge({ status }: { status: IncomingStatus }) {
  const t = useTranslations("officeDocuments");
  return <span className={`nhan ${incomingTone[status]}`}>{t(`incomingStatus_${status}`)}</span>;
}

export function OutgoingStatusBadge({ status }: { status: OutgoingStatus }) {
  const t = useTranslations("officeDocuments");
  return <span className={`nhan ${outgoingTone[status]}`}>{t(`outgoingStatus_${status}`)}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: DocumentUrgency }) {
  const t = useTranslations("officeDocuments");
  if (urgency === "normal") return <>{t("urgency_normal")}</>;
  return <span className={`nhan ${urgency === "urgent" ? "canh-bao" : "loi"}`}>{t(`urgency_${urgency}`)}</span>;
}
