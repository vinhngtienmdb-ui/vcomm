// CONG_VIEC_49 L3: bảng tin cộng đồng, đánh giá đã mua hàng, bình luận, thích, báo cáo, kiểm duyệt (KICHBAN_KIEMTHU_473 đến 475).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-bang-tin-0123456789";
const people: Record<"author" | "reader" | "others", BuyerCall> = {} as never;
const reporters: BuyerCall[] = [];
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const message = (response: request.Response) => response.body.error?.message as string;
const userIdOf = async (phone: string) => (await pool.query("SELECT id FROM core.users WHERE phone = $1", [`+84${phone.slice(1)}`])).rows[0].id as string;

// Đơn đã giao của người mua để đánh giá.
async function deliveredOrder(buyer: BuyerCall): Promise<{ id: string; lineId: string }> {
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.cream, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const order = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" })).body;
  const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
  const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
  expect(detail.status).toBe("delivered");
  return { id: order.id, lineId: detail.lines[0].orderLineId };
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0949000001", "Tác Giả Bài Đăng");
  await store.register("0949000002", "Người Đọc");
  people.author = await store.buyerSession("0949000001");
  people.reader = await store.buyerSession("0949000002");
  for (let index = 0; index < 5; index += 1) {
    await store.register(`094900010${index}`, `Người Báo Cáo ${index}`);
    reporters.push(await store.buyerSession(`094900010${index}`));
  }
  people.others = reporters[0]!;
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_49 bảng tin cộng đồng", () => {
  it("KICHBAN_KIEMTHU_473: đăng bài có ảnh, sản phẩm; đánh giá chỉ dòng đơn đã giao của mình, một lần; điểm ở trang sản phẩm; xóa bài; bài ghim VComm", async () => {
    const { author, reader } = people;
    // Ảnh: kiểm theo nội dung tệp.
    const bad = await author("post", "/buyer/posts/images").attach("file", Buffer.from("khong phai anh"), "a.png");
    expect(bad.status).toBe(400);
    const image = (await author("post", "/buyer/posts/images").attach("file", png, "anh.png")).body;
    expect(image.url).toMatch(/^\/api\/v1\/buyer\/posts\/images\//);
    // Ảnh chưa đăng chỉ người tải lên xem được.
    expect((await reader("get", `/buyer/posts/images/${image.id}`)).status).toBe(404);
    expect((await author("post", "/buyer/posts", { content: "", imageIds: [] })).status).toBe(400);
    expect((await author("post", "/buyer/posts", { content: "x".repeat(2001) })).status).toBe(400);
    expect((await author("post", "/buyer/posts", { content: "Sáu ảnh", imageIds: Array.from({ length: 6 }, () => image.id) })).status).toBe(400);
    const post = (await author("post", "/buyer/posts", { content: "Kem dưỡng da dùng rất thích, mọi người thử nhé.", imageIds: [image.id], productIds: [store.products.cream] })).body;
    expect(post).toMatchObject({ kind: "member", authorName: "Tác Giả Bài Đăng", images: [image.url], isMine: true, likeCount: 0, commentCount: 0, comments: [] });
    expect(post.products).toEqual([{ productId: store.products.cream, name: "Kem dưỡng da VComm", imageUrl: null, priceFrom: "250000" }]);
    expect((await reader("get", `/buyer/posts/images/${image.id}`)).status).toBe(200);
    // Ảnh đã gắn bài khác không dùng lại được.
    expect((await author("post", "/buyer/posts", { content: "Ảnh cũ", imageIds: [image.id] })).status).toBe(400);
    // Sản phẩm không đăng bán: sai dữ liệu.
    expect((await author("post", "/buyer/posts", { content: "Sai", productIds: [store.warehouseId] })).status).toBe(400);

    // Đánh giá: dòng đơn chưa giao hoặc của người khác bị từ chối; đánh giá cần sao.
    const order = await deliveredOrder(author);
    expect((await reader("post", "/buyer/posts", { content: "Không phải đơn của tôi", orderLineId: order.lineId, rating: 5 })).body.error.fields.orderLineId).toBe(
      "Chỉ đánh giá được hàng đã giao trong đơn của bạn.",
    );
    expect((await author("post", "/buyer/posts", { content: "Thiếu sao", orderLineId: order.lineId })).status).toBe(400);
    expect((await author("get", "/buyer/reviewable-lines")).body).toEqual([expect.objectContaining({ orderLineId: order.lineId, productName: "Kem dưỡng da VComm" })]);
    const review = (await author("post", "/buyer/posts", { content: "Hàng đúng mô tả, giao nhanh.", orderLineId: order.lineId, rating: 4 })).body;
    expect(review).toMatchObject({ kind: "review", rating: 4 });
    expect(message(await author("post", "/buyer/posts", { content: "Lần hai", orderLineId: order.lineId, rating: 5 }))).toBe("Bạn đã đánh giá sản phẩm này trong đơn hàng này.");
    expect((await author("get", "/buyer/reviewable-lines")).body).toEqual([]);
    expect((await reader("get", `/buyer/shop/products/${store.products.cream}`)).body.rating).toEqual({ average: "4", count: 1 });

    // Bài VComm ghim lên đầu; tối đa 3 bài ghim; người không có quyền bị chặn.
    for (const content of ["Thông báo 1", "Thông báo 2", "Thông báo 3"]) expect((await store.call("post", "/marketplace/community/official-posts", { content, isPinned: true })).status).toBe(201);
    expect(message(await store.call("post", "/marketplace/community/official-posts", { content: "Thông báo 4", isPinned: true }))).toBe("Đã có 3 bài ghim. Bỏ ghim một bài trước khi ghim bài khác.");
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("post", "/marketplace/community/official-posts", { companyId: retail, body: { content: "x", isPinned: false } })).status).toBe(403);
    const feed = (await reader("get", "/buyer/posts")).body;
    expect(feed.total).toBe(5);
    expect(feed.data.slice(0, 3).every((item: { kind: string; isPinned: boolean; authorName: string }) => item.kind === "official" && item.isPinned && item.authorName === "VComm")).toBe(true);
    // Lọc theo sản phẩm: bài gắn sản phẩm và đánh giá sản phẩm.
    expect((await reader("get", `/buyer/posts?productId=${store.products.cream}`)).body.data.map((item: { id: string }) => item.id).sort()).toEqual([post.id, review.id].sort());
    // Xóa bài: chỉ tác giả; bài xóa không còn hiện.
    expect((await reader("delete", `/buyer/posts/${post.id}`)).status).toBe(404);
    expect((await author("delete", `/buyer/posts/${post.id}`)).status).toBe(204);
    expect((await reader("get", `/buyer/posts/${post.id}`)).status).toBe(404);
    expect((await reader("get", "/buyer/posts")).body.total).toBe(4);
  });

  it("KICHBAN_KIEMTHU_474: bình luận, thích, giới hạn ngày, từ cấm, công tắc tắt đăng bài và bình luận", async () => {
    const { author, reader } = people;
    const post = (await author("post", "/buyer/posts", { content: "Hỏi về hộp thủy tinh" })).body;
    const commented = (await reader("post", `/buyer/posts/${post.id}/comments`, { content: "Mình dùng loại nắp gài, kín lắm." })).body;
    expect(commented).toMatchObject({ commentCount: 1, comments: [expect.objectContaining({ authorName: "Người Đọc", content: "Mình dùng loại nắp gài, kín lắm.", isMine: true })] });
    expect((await reader("post", `/buyer/posts/${post.id}/comments`, { content: "" })).status).toBe(400);
    // Thích hai lần vẫn một; bỏ thích.
    expect((await reader("put", `/buyer/posts/${post.id}/like`)).body).toEqual({ liked: true, likeCount: 1 });
    expect((await reader("put", `/buyer/posts/${post.id}/like`)).body).toEqual({ liked: true, likeCount: 1 });
    expect((await author("get", `/buyer/posts/${post.id}`)).body).toMatchObject({ likeCount: 1, likedByMe: false });
    expect((await reader("delete", `/buyer/posts/${post.id}/like`)).body).toEqual({ liked: false, likeCount: 0 });
    // Xóa bình luận của mình.
    expect((await author("delete", `/buyer/comments/${commented.comments[0].id}`)).status).toBe(404);
    expect((await reader("delete", `/buyer/comments/${commented.comments[0].id}`)).status).toBe(204);
    expect((await reader("get", `/buyer/posts/${post.id}`)).body).toMatchObject({ commentCount: 0, comments: [] });

    // Từ cấm: không phân biệt hoa thường, dấu; quyền cài đặt.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("put", "/marketplace/community/settings", { companyId: retail, body: { postingEnabled: true, commentsEnabled: true, bannedWords: [], version: 0 } })).status).toBe(403);
    expect((await store.call("put", "/marketplace/community/settings", { postingEnabled: true, commentsEnabled: true, bannedWords: ["lừa đảo", "Zalo 09"], version: 0 })).body).toEqual({
      postingEnabled: true,
      commentsEnabled: true,
      bannedWords: ["lừa đảo", "Zalo 09"],
      version: 1,
    });
    expect((await reader("post", `/buyer/posts/${post.id}/comments`, { content: "Shop LUA DAO đừng mua" })).body.error.fields.content).toBe(
      "Nội dung có từ không được phép. Sửa nội dung rồi gửi lại.",
    );
    expect((await author("post", "/buyer/posts", { content: "Liên hệ zalo 0912" })).status).toBe(400);

    // Giới hạn 10 bài mỗi ngày (tác giả đã có 4 bài hôm nay ở các kịch bản trước tính cả bài đã xóa).
    const today = (await pool.query("SELECT count(*)::int AS count FROM marketplace.posts WHERE author_user_id = $1 AND kind <> 'official'", [await userIdOf("0949000001")])).rows[0].count as number;
    for (let index = today; index < 10; index += 1) expect((await author("post", "/buyer/posts", { content: `Bài thứ ${index + 1}` })).status).toBe(201);
    expect(message(await author("post", "/buyer/posts", { content: "Bài thứ 11" }))).toBe("Bạn đã đăng đủ 10 bài hôm nay. Vui lòng quay lại ngày mai.");
    // Giới hạn 100 bình luận mỗi ngày.
    const readerId = await userIdOf("0949000002");
    await pool.query("INSERT INTO marketplace.post_comments (post_id, author_user_id, content) SELECT $1, $2, 'x' FROM generate_series(1, 99)", [post.id, readerId]);
    expect(message(await reader("post", `/buyer/posts/${post.id}/comments`, { content: "Thêm một" }))).toBe("Bạn đã bình luận đủ 100 lần hôm nay. Vui lòng quay lại ngày mai.");

    // Công tắc: tắt đăng bài, bình luận; nội dung cũ vẫn hiện.
    expect((await store.call("put", "/marketplace/community/settings", { postingEnabled: false, commentsEnabled: false, bannedWords: [], version: 1 })).status).toBe(200);
    expect((await people.others("get", "/buyer/community")).body).toEqual({ postingEnabled: false, commentsEnabled: false, ban: null });
    expect(message(await people.others("post", "/buyer/posts", { content: "Bài mới" }))).toBe("Đăng bài và bình luận đang tạm tắt. Vui lòng quay lại sau.");
    expect(message(await people.others("post", `/buyer/posts/${post.id}/comments`, { content: "Bình luận" }))).toBe("Đăng bài và bình luận đang tạm tắt. Vui lòng quay lại sau.");
    expect((await people.others("get", `/buyer/posts/${post.id}`)).status).toBe(200);
    expect((await store.call("put", "/marketplace/community/settings", { postingEnabled: true, commentsEnabled: true, bannedWords: [], version: 2 })).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_475: báo cáo, tự ẩn ở 5 báo cáo, ẩn, hiện lại, khóa và mở khóa tài khoản; thông báo tác giả; phân quyền", async () => {
    const { author, reader } = people;
    const post = (await reader("post", "/buyer/posts", { content: "Inbox mình bán rẻ hơn VComm 30%" })).body;
    expect(message(await reader("post", "/buyer/reports", { postId: post.id, reason: "spam" }))).toBe("Không báo cáo được nội dung của chính bạn.");
    expect((await author("post", "/buyer/reports", { postId: post.id, reason: "khac" })).status).toBe(400);
    expect((await author("post", "/buyer/reports", { postId: post.id, reason: "spam", description: "Quảng cáo ngoài sàn" })).status).toBe(204);
    expect(message(await author("post", "/buyer/reports", { postId: post.id, reason: "spam" }))).toBe("Bạn đã báo cáo nội dung này.");
    for (const reporter of reporters.slice(0, 3)) expect((await reporter("post", "/buyer/reports", { postId: post.id, reason: "spam" })).status).toBe(204);
    expect((await author("get", `/buyer/posts/${post.id}`)).status).toBe(200);
    // Báo cáo thứ năm: tự ẩn tạm; tác giả vẫn thấy bài của mình với trạng thái ẩn tạm.
    expect((await reporters[3]!("post", "/buyer/reports", { postId: post.id, reason: "scam" })).status).toBe(204);
    expect((await author("get", `/buyer/posts/${post.id}`)).status).toBe(404);
    expect((await reader("get", `/buyer/posts/${post.id}`)).body.status).toBe("auto_hidden");

    // Hàng chờ kiểm duyệt; người không có quyền bị chặn.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("get", "/marketplace/community/moderation", { companyId: retail })).status).toBe(403);
    const queue = (await store.call("get", "/marketplace/community/moderation?view=reported")).body;
    expect(queue.data[0]).toMatchObject({ target: "post", id: post.id, authorName: "Người Đọc", status: "auto_hidden", pendingReports: 5, topReason: "spam" });
    // Hiện lại: bỏ qua báo cáo; hàng chờ trống.
    expect((await store.call("post", `/marketplace/community/posts/${post.id}/show`)).status).toBe(204);
    expect((await author("get", `/buyer/posts/${post.id}`)).status).toBe(200);
    expect((await store.call("get", "/marketplace/community/moderation?view=reported")).body.total).toBe(0);
    // Ẩn cần lý do; ẩn thì báo tác giả.
    expect((await store.call("post", `/marketplace/community/posts/${post.id}/hide`, { reason: "" })).status).toBe(400);
    expect((await store.call("post", `/marketplace/community/posts/${post.id}/hide`, { reason: "Quảng cáo bán hàng ngoài sàn" })).status).toBe(204);
    expect((await store.call("get", "/marketplace/community/moderation?view=hidden")).body.data[0]).toMatchObject({ id: post.id, status: "hidden", hiddenReason: "Quảng cáo bán hàng ngoài sàn" });
    const readerId = await userIdOf("0949000002");
    const notices = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'community.%'", [readerId]);
    expect(notices.rows.map((row) => row.kind)).toEqual(["community.post_hidden"]);
    // Ẩn bình luận: số bình luận giảm.
    // Tác giả đã đủ 10 bài hôm nay (kịch bản 474) nên dùng người khác đăng.
    const target = (await people.others("post", "/buyer/posts", { content: "Bài có bình luận" })).body;
    const withComment = (await people.others("post", `/buyer/posts/${target.id}/comments`, { content: "Shop dở tệ" })).body;
    expect(withComment.commentCount).toBe(1);
    // Bình luận đang hiện có một báo cáo: "hiện lại" bỏ qua báo cáo, không đổi trạng thái; không còn báo cáo thì báo không đổi.
    const commentId = withComment.comments[0].id;
    expect((await author("post", "/buyer/reports", { commentId, reason: "abuse" })).status).toBe(204);
    expect((await store.call("get", "/marketplace/community/moderation?view=reported")).body.data).toEqual([
      expect.objectContaining({ target: "comment", id: commentId, status: "visible", pendingReports: 1 }),
    ]);
    expect((await store.call("post", `/marketplace/community/comments/${commentId}/show`)).status).toBe(204);
    expect((await store.call("get", "/marketplace/community/moderation?view=reported")).body.total).toBe(0);
    expect((await store.call("post", `/marketplace/community/comments/${commentId}/show`)).status).toBe(409);
    expect((await store.call("post", `/marketplace/community/comments/${withComment.comments[0].id}/hide`, { reason: "Xúc phạm" })).status).toBe(204);
    expect((await people.others("get", `/buyer/posts/${target.id}`)).body).toMatchObject({ commentCount: 0, comments: [expect.objectContaining({ content: null, status: "hidden" })] });

    // Khóa 7 ngày: không đăng, không bình luận; vẫn xem; mở khóa thì đăng được.
    const banned = (await store.call("post", "/marketplace/community/bans", { userId: readerId, days: 7, reason: "Quảng cáo rác lặp lại" })).body;
    expect(banned).toEqual([expect.objectContaining({ userId: readerId, reason: "Quảng cáo rác lặp lại", until: expect.any(String) })]);
    expect((await reader("get", "/buyer/community")).body.ban).toMatchObject({ reason: "Quảng cáo rác lặp lại" });
    expect(message(await reader("post", "/buyer/posts", { content: "Thử đăng" }))).toBe("Tài khoản của bạn đang bị khóa đăng bài và bình luận.");
    expect((await reader("get", "/buyer/posts")).status).toBe(200);
    // Khóa vĩnh viễn thay khóa cũ.
    const forever = (await store.call("post", "/marketplace/community/bans", { userId: readerId, days: null, reason: "Vi phạm nhiều lần" })).body;
    expect(forever).toEqual([expect.objectContaining({ until: null, reason: "Vi phạm nhiều lần" })]);
    expect((await store.call("post", `/marketplace/community/bans/${forever[0].id}/lift`)).body).toEqual([]);
    expect((await reader("get", "/buyer/community")).body.ban).toBeNull();
    const kinds = (await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'community.%' ORDER BY created_at", [readerId])).rows.map((row) => row.kind);
    expect(kinds).toEqual(["community.post_hidden", "community.banned", "community.banned", "community.unbanned"]);
  });
});
