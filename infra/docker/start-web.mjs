// Khởi động 12 mini app Next.js trong một container (CONG_VIEC_76, quyết định mini app chung một dịch vụ).
// Mini app Nền tảng nghe cổng PORT (nền tảng chạy container cấp), các mini app khác nghe cổng cố định ở localhost
// đúng địa chỉ mặc định trong rewrites của apps/web-platform/next.config.ts.
// Một tiến trình con dừng thì dừng cả container để nền tảng khởi động lại.
import { spawn } from "node:child_process";
import { join } from "node:path";

const applications = [
  { name: "web-platform", port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" },
  { name: "web-catalog", port: 3001 },
  { name: "web-inventory", port: 3002 },
  { name: "web-crm", port: 3003 },
  { name: "web-purchasing", port: 3004 },
  { name: "web-sales", port: 3005 },
  { name: "web-finance", port: 3006 },
  { name: "web-hr", port: 3007 },
  { name: "web-analytics", port: 3009 },
  { name: "web-office", port: 3011 },
  { name: "web-retail", port: 3012 },
  { name: "web-affiliate", port: 3013 },
];

const children = [];
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 10_000).unref();
}

for (const application of applications) {
  const directory = join(process.cwd(), "apps", application.name);
  const child = spawn(process.execPath, [join(directory, "node_modules", "next", "dist", "bin", "next"), "start", "--port", String(application.port), "--hostname", application.host ?? "127.0.0.1"], {
    cwd: directory,
    stdio: "inherit",
    env: { ...process.env, PORT: String(application.port) },
  });
  child.on("exit", (code, signal) => {
    if (!stopping) console.error(`Mini app ${application.name} dừng (mã ${code ?? signal}); dừng container.`);
    stopAll(code ?? 1);
    if (children.every((item) => item.exitCode !== null || item.signalCode !== null)) process.exit(code ?? 1);
  });
  children.push(child);
}

process.on("SIGTERM", () => stopAll(0));
process.on("SIGINT", () => stopAll(0));
