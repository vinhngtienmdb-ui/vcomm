// Đường dẫn sản phẩm của cộng tác viên /p/<mã sản phẩm>?ctv=<mã> (CONG_VIEC_49; QUYTAC_NGHIEPVU_325): đã đăng nhập thì ghi lượt bấm rồi mở sản phẩm;
// chưa đăng nhập thì giữ mã, mở đăng nhập, ghi sau khi đăng nhập.
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Loading } from "@/components/ui";
import { holdCollaboratorClick, recordCollaboratorClick } from "@/lib/collaborator-link";
import { useSession } from "@/lib/session";

export default function CollaboratorProductLink() {
  const { id, ctv } = useLocalSearchParams<{ id: string; ctv?: string }>();
  const { stage } = useSession();
  const [done, setDone] = useState(false);
  const productId = typeof id === "string" ? id : "";
  const code = typeof ctv === "string" ? ctv.trim().toUpperCase().slice(0, 8) : "";
  useEffect(() => {
    if (stage !== "ready") {
      if (code) holdCollaboratorClick(code, productId);
      return;
    }
    if (!code) return setDone(true);
    void recordCollaboratorClick(code, productId).finally(() => setDone(true));
  }, [stage, code, productId]);
  if (stage !== "ready") return <Redirect href="/dang-nhap" />;
  if (!done) return <Loading />;
  return <Redirect href={{ pathname: "/san-pham/[id]", params: { id: productId } }} />;
}
