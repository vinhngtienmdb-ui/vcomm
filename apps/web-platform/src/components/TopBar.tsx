"use client";

// ThanhTrenCung (tài liệu 15 mục 6): trang chủ, chọn công ty (CHUC_NANG_11), hộp duyệt, thông báo, đăng xuất.
import type { MeResponse, NotificationItem, NotificationListResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, rememberCompany } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Drawer } from "./Dialogs";

export function TopBar({ me, onCompanyChange }: { me: MeResponse; onCompanyChange: () => void }) {
  const t = useTranslations("topBar");
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<NotificationListResponse | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Số thông báo chưa đọc làm mới mỗi phút.
  const loadNotifications = useCallback(async () => {
    try {
      setNotifications(await apiFetch<NotificationListResponse>("/notifications"));
    } catch {
      // Lỗi tải thông báo không chặn trang; lần làm mới sau thử lại.
    }
  }, []);
  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => void loadNotifications(), 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) await apiFetch(`/notifications/${item.id}/read`, { method: "POST" }).catch(() => undefined);
    setShowNotifications(false);
    void loadNotifications();
    if (item.link) router.push(item.link);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/dang-nhap");
    }
  }

  return (
    <>
      <header className="thanh-tren">
        <a className="logo" href="/">
          VComm
        </a>
        <a href="/">{t("home")}</a>
        <span className="gian" />
        {me.companies.length > 1 ? (
          <>
            <label htmlFor="chon-cong-ty" className="an-nhan">
              {t("company")}
            </label>
            <select
              id="chon-cong-ty"
              value={me.currentCompanyId ?? ""}
              onChange={(event) => {
                rememberCompany(event.target.value);
                onCompanyChange();
              }}
              style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: 0, borderRadius: 999, padding: "4px 12px", font: "inherit", fontSize: 13 }}
            >
              {me.companies.map((company) => (
                <option key={company.id} value={company.id} style={{ color: "#0F172A" }}>
                  {company.shortName}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span style={{ fontSize: 13 }}>{me.companies[0]?.shortName}</span>
        )}
        <a href="/de-xuat">{t("proposals")}</a>
        <a href="/hop-duyet">{t("approvals")}</a>
        <button type="button" onClick={() => setShowNotifications(true)} aria-haspopup="dialog">
          {t("notifications")} {notifications && notifications.unreadCount > 0 && <span className="huy-hieu">{notifications.unreadCount}</span>}
        </button>
        <a href="/ho-so" title={t("profile")} style={{ fontSize: 13 }}>
          {me.user.fullName}
        </a>
        <button type="button" onClick={logout} disabled={loggingOut}>
          {t("logout")}
        </button>
      </header>
      {showNotifications && <NotificationsDrawer list={notifications} onClose={() => setShowNotifications(false)} onOpen={(item) => void openNotification(item)} />}
    </>
  );
}

// Nội dung thông báo dựng theo loại và ngôn ngữ đang chọn; loại chưa biết thì dùng tiêu đề lưu sẵn.
function useNotificationText() {
  const t = useTranslations("notifications");
  return (item: NotificationItem) => {
    const payload = item.payload as { documentNo?: string; date?: string; handover?: boolean; escalated?: boolean; decision?: string };
    let key = `kind_${item.kind.replaceAll(".", "_")}`;
    if (item.kind === "approval.assigned" && payload.handover) key = "kind_approval_handover";
    if (item.kind === "approval.assigned" && payload.escalated) key = "kind_approval_escalated_to_you";
    if (item.kind === "approval.completed") key = `kind_approval_completed_${payload.decision}`;
    if (!t.has(key)) return item.title;
    if (payload.documentNo) return t(key, { documentNo: payload.documentNo });
    if (payload.date) return t(key, { date: payload.date.split("-").reverse().join("/") });
    return item.title;
  };
}

function NotificationsDrawer({ list, onClose, onOpen }: { list: NotificationListResponse | null; onClose: () => void; onOpen: (item: NotificationItem) => void }) {
  const t = useTranslations("notifications");
  const text = useNotificationText();
  return (
    <Drawer title={t("title")} onClose={onClose}>
      {list && list.unreadCount > 0 && <span className="chu-thich">{t("unread", { count: list.unreadCount })}</span>}
      {!list || list.data.length === 0 ? (
        <p style={{ margin: 0 }}>{t("empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--khoang-2)" }}>
          {list.data.map((item) => (
            <li key={item.id}>
              <button type="button" className="the" style={{ width: "100%", textAlign: "left", cursor: "pointer", font: "inherit", fontWeight: item.readAt ? 400 : 700 }} onClick={() => onOpen(item)}>
                {text(item)}
                <span className="chu-thich" style={{ display: "block", fontWeight: 400 }}>
                  {formatDateTime(item.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
