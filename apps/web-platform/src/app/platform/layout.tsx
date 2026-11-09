import type { ReactNode } from "react";
import { AdminShell } from "@/components/AdminShell";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
