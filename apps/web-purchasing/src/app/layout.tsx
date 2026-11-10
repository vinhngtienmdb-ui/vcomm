import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Nunito_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "ui/styles.css";
import { PurchasingShell } from "@/components/PurchasingShell";

// Phông chữ theo tài liệu 15 mục 3, có bộ ký tự tiếng Việt.
const nunitoSans = Nunito_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "800"],
  variable: "--phong-nunito",
});

export const metadata: Metadata = { title: "VComm – Mua hàng" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={nunitoSans.variable}>
      <body>
        <NextIntlClientProvider>
          <PurchasingShell>{children}</PurchasingShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
