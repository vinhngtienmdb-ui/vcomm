import { messages, resolveLocale } from "i18n";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const localeCookieName = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(localeCookieName)?.value);
  return { locale, messages: messages[locale], timeZone: "Asia/Ho_Chi_Minh" };
});
