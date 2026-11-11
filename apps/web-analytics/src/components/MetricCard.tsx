// Thẻ chỉ tiêu của báo cáo quản trị: tên, số chính, dòng phụ; bấm để mở báo cáo chi tiết.
import Link from "next/link";

export function MetricCard({ title, value, detail, href }: { title: string; value: string; detail?: string; href?: string }) {
  const content = (
    <>
      <span className="chu-thich">{title}</span>
      <strong style={{ fontSize: 20, lineHeight: "28px" }}>{value}</strong>
      {detail && <span className="chu-thich">{detail}</span>}
    </>
  );
  return href ? (
    <Link className="the" href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  ) : (
    <div className="the">{content}</div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>{children}</div>;
}
