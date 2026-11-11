// Soạn email cho ứng viên, người phỏng vấn và tệp lịch iCalendar (CONG_VIEC_54; QUYTAC_NGHIEPVU_385). Mẫu nằm trong tệp dịch nhóm recruitmentEmails.
import { messages } from "i18n";

export type EmailLocale = "vi" | "en";
type Templates = (typeof messages)["vi"]["recruitmentEmails"];

export const fillTemplate = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

export function formatInterviewTime(startsAt: string, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

export const formatDay = (day: string) => day.split("-").reverse().join("/");
export const formatMoney = (value: string, locale: EmailLocale) => `${new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(Number(value))} ${locale === "en" ? "VND" : "đồng"}`;

export interface InterviewEmailInput {
  kind: "interview_invitation" | "interview_update" | "interview_cancellation";
  locale: EmailLocale;
  candidateName: string;
  companyName: string;
  postingTitle: string;
  roundName: string;
  startsAt: string;
  durationMinutes: number;
  mode: "onsite" | "online";
  location: string | null;
  meetingUrl: string | null;
  contactEmail: string;
  message: string | null;
}

export function interviewEmail(input: InterviewEmailInput): { subject: string; body: string } {
  const text: Templates = messages[input.locale].recruitmentEmails;
  const values = {
    name: input.candidateName,
    company: input.companyName,
    title: input.postingTitle,
    round: input.roundName,
    time: formatInterviewTime(input.startsAt, input.locale),
    duration: input.durationMinutes,
    place: input.mode === "onsite" ? fillTemplate(text.placeOnsite, { location: input.location ?? "" }) : fillTemplate(text.placeOnline, { url: input.meetingUrl ?? "" }),
    email: input.contactEmail,
    message: input.message ? `${input.message}\n\n` : "",
  };
  const subject = { interview_invitation: text.invitationSubject, interview_update: text.updateSubject, interview_cancellation: text.cancellationSubject }[input.kind];
  const body = { interview_invitation: text.invitationBody, interview_update: text.updateBody, interview_cancellation: text.cancellationBody }[input.kind];
  return { subject: fillTemplate(subject, values), body: fillTemplate(body, values) };
}

export function interviewerEmail(input: InterviewEmailInput & { interviewerName: string }): { subject: string; body: string } {
  const text: Templates = messages.vi.recruitmentEmails;
  const values = {
    name: input.interviewerName,
    candidate: input.candidateName,
    title: input.postingTitle,
    round: input.roundName,
    time: formatInterviewTime(input.startsAt, "vi"),
    duration: input.durationMinutes,
    place: input.mode === "onsite" ? fillTemplate(text.placeOnsite, { location: input.location ?? "" }) : fillTemplate(text.placeOnline, { url: input.meetingUrl ?? "" }),
  };
  const cancelled = input.kind === "interview_cancellation";
  return {
    subject: fillTemplate(cancelled ? text.interviewerCancelSubject : text.interviewerSubject, values),
    body: fillTemplate(cancelled ? text.interviewerCancelBody : text.interviewerBody, values),
  };
}

export function rejectionEmail(input: { locale: EmailLocale; candidateName: string; companyName: string; postingTitle: string; contactEmail: string; message: string | null }) {
  const text: Templates = messages[input.locale].recruitmentEmails;
  const values = { name: input.candidateName, company: input.companyName, title: input.postingTitle, email: input.contactEmail, message: input.message ? `${input.message}\n\n` : "" };
  return { subject: fillTemplate(text.rejectionSubject, values), body: fillTemplate(text.rejectionBody, values) };
}

export function offerEmail(input: {
  locale: EmailLocale;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  departmentName: string;
  branchName: string;
  salary: string;
  startDate: string;
  responseDeadline: string;
  link: string;
  contactEmail: string;
  message: string | null;
}) {
  const text: Templates = messages[input.locale].recruitmentEmails;
  const values = {
    name: input.candidateName,
    company: input.companyName,
    title: input.jobTitle,
    department: input.departmentName,
    branch: input.branchName,
    salary: formatMoney(input.salary, input.locale),
    start: formatDay(input.startDate),
    deadline: formatDay(input.responseDeadline),
    link: input.link,
    email: input.contactEmail,
    message: input.message ? `${input.message}\n\n` : "",
  };
  return { subject: fillTemplate(text.offerSubject, values), body: fillTemplate(text.offerBody, values) };
}

// iCalendar (RFC 5545): mỗi vòng phỏng vấn một mã sự kiện; đổi giờ tăng SEQUENCE; hủy gửi METHOD:CANCEL.
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
// Dòng dài hơn 75 byte phải gấp (RFC 5545 mục 3.1).
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const character of line) {
    if (Buffer.byteLength(current + character, "utf8") > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
    }
    current += character;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function interviewCalendar(input: {
  interviewId: string;
  sequence: number;
  cancelled: boolean;
  startsAt: string;
  durationMinutes: number;
  summary: string;
  description: string;
  location: string;
  organizerEmail: string;
  now: Date;
}): { fileName: string; contentType: string; content: string } {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VComm//Tuyen dung//VI",
    `METHOD:${input.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:phong-van-${input.interviewId}@vcomm`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${icsTime(input.now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(input.summary)}`,
    `DESCRIPTION:${icsText(input.description)}`,
    `LOCATION:${icsText(input.location)}`,
    `ORGANIZER:mailto:${input.organizerEmail}`,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { fileName: "invite.ics", contentType: `text/calendar; charset=utf-8; method=${input.cancelled ? "CANCEL" : "REQUEST"}`, content: lines.map(fold).join("\r\n") + "\r\n" };
}
