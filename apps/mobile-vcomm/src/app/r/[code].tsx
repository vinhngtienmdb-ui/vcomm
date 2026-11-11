// Đường dẫn giới thiệu /r/<số điện thoại>: chưa đăng nhập thì mở đăng ký với mã điền sẵn; đã đăng nhập thì mở tài khoản (QUYTAC_NGHIEPVU_142).
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSession } from "@/lib/session";

export default function ReferralLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { stage } = useSession();
  const ma = typeof code === "string" ? code.replace(/[^0-9+]/g, "").slice(0, 15) : "";
  if (stage === "ready") return <Redirect href={{ pathname: "/tai-khoan", params: { ma } }} />;
  return <Redirect href={{ pathname: "/dang-ky", params: { ma } }} />;
}
