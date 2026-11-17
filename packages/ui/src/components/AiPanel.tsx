"use client";

// MAN_HINH_242 Ngăn trợ lý AI (CONG_VIEC_63; CHUC_NANG_227, 229; API_273 đến API_276). Tải riêng khi người dùng mở ngăn.
import type { AiConversationDetail, AiConversationItem, AiFeedbackReason, AiMeResponse, AiMessageItem, AiToolCall, AiToolName, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { Fragment, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, apiFetch, apiStream, readEvents } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import { ConfirmDialog } from "./Dialogs";

const reasons: AiFeedbackReason[] = ["wrong_figures", "not_relevant", "missing_data", "other"];

// Màn hình nguồn của từng công cụ (đường dẫn tuyệt đối vì mỗi mini app có basePath riêng).
function sourceHref(call: AiToolCall): string {
  // Tham số do mô hình gửi: chỉ dùng mã định danh đúng dạng UUID trong đường dẫn.
  const id = typeof call.input.id === "string" && /^[0-9a-f-]{36}$/i.test(call.input.id) ? call.input.id : "";
  const links: Record<AiToolName, string> = {
    sales_report: "/analytics/sales",
    inventory_report: "/analytics/inventory",
    debt_report: "/analytics/debts",
    commission_report: "/analytics/commissions",
    overview_report: "/analytics",
    sales_orders: "/sales/orders",
    sales_order_detail: id ? `/sales/orders/${id}` : "/sales/orders",
    products: "/catalog/products",
    product_detail: id ? `/catalog/products/${id}` : "/catalog/products",
    stock: "/inventory/stock",
  };
  return links[call.name];
}

// Hiển thị câu trả lời dạng văn bản: đoạn, gạch đầu dòng, chữ đậm **…**, bảng | … | giữ nguyên dạng chữ. Không hiển thị HTML.
function Answer({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>));
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let table: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ds-${blocks.length}`}>
          {bullets.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (table.length) {
      blocks.push(<pre key={`bang-${blocks.length}`}>{table.join("\n")}</pre>);
      table = [];
    }
  };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^[-*•] /.test(trimmed)) {
      if (table.length) flush();
      bullets.push(trimmed.slice(2));
    } else if (trimmed.startsWith("|")) {
      if (bullets.length) flush();
      table.push(trimmed);
    } else {
      flush();
      if (trimmed) blocks.push(<p key={`doan-${blocks.length}`}>{inline(trimmed)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function Sources({ calls }: { calls: AiToolCall[] }) {
  const t = useTranslations("aiAssistant");
  if (calls.length === 0) return null;
  const describe = (call: AiToolCall) => {
    const parts: string[] = [];
    const input = call.input as Record<string, string | undefined>;
    if (input.from && input.to) parts.push(`${formatDate(input.from)}–${formatDate(input.to)}`);
    if (input.side) parts.push(t(`side_${input.side}` as "side_receivable"));
    if (input.groupBy) parts.push(t("groupBy", { value: t.has(`group_${input.groupBy}`) ? t(`group_${input.groupBy}` as "group_channel") : input.groupBy }));
    if (input.search) parts.push(`“${input.search}”`);
    return parts.join(" · ");
  };
  return (
    <div className="nguon">
      <strong>{t("sources")}</strong>{" "}
      {calls.map((call, index) => (
        <Fragment key={index}>
          {index > 0 && "; "}
          <a href={sourceHref(call)}>{t(`tool_${call.name}`)}</a>
          {describe(call) && ` · ${describe(call)}`}
          {!call.ok && ` (${t("toolFailed")})`}
        </Fragment>
      ))}
      <br />
      {t("mayBeWrong")}
    </div>
  );
}

function Feedback({ message, onChange }: { message: AiMessageItem; onChange: (message: AiMessageItem) => void }) {
  const t = useTranslations("aiAssistant");
  const [choosing, setChoosing] = useState(false);
  const [reason, setReason] = useState<AiFeedbackReason>(message.feedback?.reason ?? "wrong_figures");
  const [note, setNote] = useState(message.feedback?.note ?? "");
  const [busy, setBusy] = useState(false);
  const rating = message.feedback?.rating ?? null;

  async function save(body: { rating: "up" | "down"; reason?: AiFeedbackReason; note?: string } | null) {
    setBusy(true);
    try {
      if (body === null) {
        await apiFetch(`/ai/messages/${message.id}/feedback`, { method: "DELETE" });
        onChange({ ...message, feedback: null });
      } else {
        const feedback = await apiFetch<AiMessageItem["feedback"]>(`/ai/messages/${message.id}/feedback`, { method: "PUT", body: JSON.stringify(body) });
        onChange({ ...message, feedback });
      }
      setChoosing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="danh-gia">
      <span>{t("feedbackLabel")}</span>
      <button type="button" aria-pressed={rating === "up"} disabled={busy} onClick={() => void (rating === "up" ? save(null) : save({ rating: "up" }))}>
        ✓ {t("up")}
      </button>
      <button type="button" aria-pressed={rating === "down"} disabled={busy} onClick={() => (rating === "down" ? void save(null) : setChoosing((current) => !current))}>
        ✗ {t("down")}
      </button>
      {choosing && (
        <form
          style={{ display: "grid", gap: "var(--khoang-2)", width: "100%" }}
          onSubmit={(event) => {
            event.preventDefault();
            void save({ rating: "down", reason, note: note.trim() });
          }}
        >
          <label className="an-nhan" htmlFor={`ly-do-${message.id}`}>
            {t("reason")}
          </label>
          <select id={`ly-do-${message.id}`} className="o-nhap" value={reason} onChange={(event) => setReason(event.target.value as AiFeedbackReason)}>
            {reasons.map((item) => (
              <option key={item} value={item}>
                {t(`reason_${item}`)}
              </option>
            ))}
          </select>
          <label className="an-nhan" htmlFor={`ghi-chu-${message.id}`}>
            {t("note")}
          </label>
          <input id={`ghi-chu-${message.id}`} className="o-nhap" maxLength={500} placeholder={t("note")} value={note} onChange={(event) => setNote(event.target.value)} />
          <button type="submit" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy} style={{ justifySelf: "start" }}>
            {t("saveFeedback")}
          </button>
        </form>
      )}
    </div>
  );
}

function AssistantMessage({ message, onChange }: { message: AiMessageItem; onChange: (message: AiMessageItem) => void }) {
  const t = useTranslations("aiAssistant");
  return (
    <div className="tin tro-ly">
      {message.status === "refusal" ? (
        <p>{t("refusal")}</p>
      ) : message.status === "error" ? (
        <p>{t("failed")}</p>
      ) : (
        <>
          <Answer text={message.content} />
          {message.status === "max_tokens" && <p className="chu-thich">{t("truncated")}</p>}
        </>
      )}
      <Sources calls={message.toolCalls} />
      {message.status !== "error" && <Feedback message={message} onChange={onChange} />}
    </div>
  );
}

export default function AiPanel({ status, onStatus, onClose }: { status: AiMeResponse; onStatus: (status: AiMeResponse) => void; onClose: () => void }) {
  const t = useTranslations("aiAssistant");
  const notice = useTranslations("aiNotice");
  const [conversations, setConversations] = useState<AiConversationItem[]>([]);
  const [current, setCurrent] = useState<AiConversationDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState<{ text: string; tool: AiToolName | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const chat = status.features.find((feature) => feature.feature === "chat")!;

  const loadList = useCallback(async () => {
    try {
      setConversations((await apiFetch<PageResponse<AiConversationItem>>("/ai/conversations?pageSize=20")).data);
    } catch {
      // Danh sách hội thoại lỗi không chặn việc hỏi.
    }
  }, []);
  useEffect(() => {
    if (chat.permitted) void loadList();
  }, [chat.permitted, loadList]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [current, streaming]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function open(id: string) {
    setError(null);
    try {
      setCurrent(await apiFetch<AiConversationDetail>(`/ai/conversations/${id}`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function acknowledge() {
    onStatus(await apiFetch<AiMeResponse>("/ai/me/acknowledge", { method: "POST", body: JSON.stringify({ noticeVersion: status.notice.version }) }));
  }

  async function ask(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    setQuestion("");
    setStreaming({ text: "", tool: null });
    let conversationId = current?.id ?? null;
    try {
      const response = await apiStream("/ai/conversations/messages", { conversationId, content });
      await readEvents(response, (type, data) => {
        if (type === "conversation") {
          conversationId = data.id as string;
          // Câu hỏi hiện ngay (bản đã che lấy lại khi tải hội thoại sau lượt).
          setCurrent((previous) => ({
            ...(previous && previous.id === conversationId ? previous : { id: conversationId!, title: data.title as string, messageCount: 0, lastMessageAt: new Date().toISOString(), messages: [] }),
            messages: [
              ...(previous && previous.id === conversationId ? previous.messages : []),
              { id: data.userMessageId as string, role: "user", content, toolCalls: [], status: "ok", createdAt: new Date().toISOString(), feedback: null },
            ],
          }));
        } else if (type === "tool") setStreaming((value) => ({ text: value?.text ?? "", tool: data.name as AiToolName }));
        else if (type === "delta") setStreaming((value) => ({ text: (value?.text ?? "") + (data.text as string), tool: null }));
        else if (type === "error") setError(data.message as string);
      });
      if (conversationId) await open(conversationId);
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.body?.code === "BUSINESS_RULE") setError(t("conversationFull"));
      else setError(failure instanceof Error ? failure.message : String(failure));
      if (failure instanceof ApiFailure) setQuestion(content);
    } finally {
      setStreaming(null);
      void loadList();
      onStatus(await apiFetch<AiMeResponse>("/ai/me").catch(() => status));
    }
  }

  async function remove() {
    if (!current) return;
    setDeleting(true);
    try {
      await apiFetch(`/ai/conversations/${current.id}`, { method: "DELETE" });
      setCurrent(null);
      setConfirmDelete(false);
      void loadList();
    } finally {
      setDeleting(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const blocked = chat.reason && chat.reason !== "notice_required" ? t(`unavailable_${chat.reason}` as "unavailable_disabled", { time: formatDateTime(chat.reopensAt) }) : null;
  const canAsk = chat.available && !streaming;

  return (
    <aside className="ngan-tro-ly" aria-label={t("title")}>
      <div className="dau-ngan">
        <h2>✦ {t("title")}</h2>
        <button type="button" className="nut phu" onClick={() => setCurrent(null)} disabled={!current || Boolean(streaming)}>
          + {t("newConversation")}
        </button>
        <button type="button" className="nut phu" onClick={() => setConfirmDelete(true)} disabled={!current || Boolean(streaming)}>
          {t("deleteConversation")}
        </button>
        <button type="button" className="nut phu" aria-label={t("close")} onClick={onClose}>
          ✕
        </button>
      </div>
      <nav className="ds-hoi-thoai" aria-label={t("conversations")}>
        {conversations.length === 0 ? (
          <span className="chu-thich">{t("noConversations")}</span>
        ) : (
          conversations.map((item) => (
            <button key={item.id} type="button" aria-current={current?.id === item.id} title={item.title} disabled={Boolean(streaming)} onClick={() => void open(item.id)}>
              {item.title}
            </button>
          ))
        )}
      </nav>
      <div className="dong-tin" aria-live="polite">
        {chat.reason === "notice_required" ? (
          <div className="the" role="group" aria-labelledby="thong-bao-du-lieu">
            <h3 id="thong-bao-du-lieu" style={{ margin: 0 }}>
              {notice("title", { version: status.notice.version })}
            </h3>
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
              {(["sent", "redacted", "training", "retention"] as const).map((key) => (
                <li key={key}>{notice(key)}</li>
              ))}
            </ul>
            <div className="nhom-nut">
              <button type="button" className="nut chinh" onClick={() => void acknowledge()}>
                {notice("accept")}
              </button>
              <button type="button" className="nut phu" onClick={onClose}>
                {notice("later")}
              </button>
            </div>
          </div>
        ) : !current ? (
          <div className="the">
            <strong>{t("welcome")}</strong>
            <span className="chu-thich">{t("welcomeHint")}</span>
          </div>
        ) : (
          current.messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="tin cua-toi">
                {message.content}
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onChange={(changed) => setCurrent((value) => value && { ...value, messages: value.messages.map((item) => (item.id === changed.id ? changed : item)) })}
              />
            ),
          )
        )}
        {streaming && (
          <div className="tin tro-ly">
            {streaming.tool && <div className="dang-goi">⟳ {t("working", { tool: t(`tool_${streaming.tool}`) })}</div>}
            {streaming.text ? <Answer text={streaming.text} /> : !streaming.tool && <div className="dang-goi">⟳ {t("thinking")}</div>}
          </div>
        )}
        {error && (
          <div className="khoi-canh-bao loi" role="alert">
            {error}
          </div>
        )}
        <div ref={bottom} />
      </div>
      {chat.reason !== "notice_required" && (
        <form className="o-hoi" onSubmit={submit}>
          {blocked && (
            <div className="khoi-canh-bao canh-bao" role="status">
              {blocked}
            </div>
          )}
          {!current && chat.available && (
            <div className="goi-y" aria-label={t("suggestions")}>
              {(["suggestion1", "suggestion2", "suggestion3"] as const).map((key) => (
                <button key={key} type="button" disabled={!canAsk} onClick={() => void ask(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          )}
          <label className="an-nhan" htmlFor="cau-hoi-tro-ly">
            {t("question")}
          </label>
          <textarea
            id="cau-hoi-tro-ly"
            className="o-nhap"
            rows={2}
            maxLength={2000}
            placeholder={t("placeholder")}
            value={question}
            disabled={!chat.available}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(question);
              }
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--khoang-2)" }}>
            <span className="chu-thich" style={{ flex: 1 }}>
              {t("remaining", { remaining: status.remainingTurnsToday, total: status.dailyTurns })}
            </span>
            <button type="submit" className={`nut chinh${streaming ? " dang-xu-ly" : ""}`} disabled={!canAsk || !question.trim()}>
              {t("send")}
            </button>
          </div>
        </form>
      )}
      {confirmDelete && (
        <ConfirmDialog title={t("deleteConfirmTitle")} text={t("deleteConfirmText")} confirmLabel={t("deleteConversation")} busy={deleting} onConfirm={() => void remove()} onClose={() => setConfirmDelete(false)} />
      )}
    </aside>
  );
}
