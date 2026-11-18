// Kiểm thử CONG_VIEC_79: lưu tệp trên kho tương thích S3 khác AWS (Supabase Storage); cấu hình AWS S3 cũ giữ nguyên hành vi.
// Kho S3 giả chạy cục bộ (node:http), không gọi AWS, Supabase.
import type { S3Client } from "@aws-sdk/client-s3";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createFileStorage, readS3Config, S3FileStorage } from "../src/common/file-storage";

interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
}

const savedEnvironment = { ...process.env };
let server: Server;
let endpoint: string;
const requests: RecordedRequest[] = [];
const objects = new Map<string, Buffer>();

beforeAll(async () => {
  // Khóa giả cho SDK ký yêu cầu; không phải khóa thật.
  process.env.AWS_ACCESS_KEY_ID = "khoa-truy-cap-gia";
  process.env.AWS_SECRET_ACCESS_KEY = "khoa-bi-mat-gia";
  server = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      const url = incoming.url ?? "";
      requests.push({ method: incoming.method ?? "", url, headers: incoming.headers });
      const path = url.split("?")[0]!;
      if (incoming.method === "PUT") {
        objects.set(path, Buffer.concat(chunks));
        response.writeHead(200, { etag: '"etag-gia"' }).end();
      } else if (incoming.method === "GET" && objects.has(path)) {
        response.writeHead(200, { "content-type": "application/octet-stream" }).end(objects.get(path));
      } else if (incoming.method === "DELETE") {
        objects.delete(path);
        response.writeHead(204).end();
      } else response.writeHead(404, { "content-type": "application/xml" }).end("<Error><Code>NoSuchKey</Code></Error>");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không mở được cổng kho S3 giả.");
  endpoint = `http://127.0.0.1:${address.port}/storage/v1/s3`;
});

afterAll(async () => {
  process.env = savedEnvironment;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  requests.length = 0;
  objects.clear();
});

describe("CONG_VIEC_79 cấu hình lưu tệp S3", () => {
  it("KICHBAN_KIEMTHU_840: cấu hình AWS cũ (chỉ S3_BUCKET, AWS_REGION) giữ nguyên: không địa chỉ riêng, đường dẫn theo tên miền, mã hóa AES256", () => {
    expect(readS3Config({ S3_BUCKET: "vcomm-tep", AWS_REGION: "ap-southeast-1" })).toEqual({
      bucket: "vcomm-tep",
      region: "ap-southeast-1",
      endpoint: undefined,
      forcePathStyle: false,
      serverSideEncryption: "AES256",
    });
    expect(readS3Config({ S3_BUCKET: "vcomm-tep" }).region).toBe("ap-southeast-1");
  });

  it("KICHBAN_KIEMTHU_839: cấu hình Supabase Storage: địa chỉ máy chủ, kiểu đường dẫn, mặc định bỏ tiêu đề mã hóa", () => {
    expect(readS3Config({ S3_BUCKET: "vcomm-tep", S3_ENDPOINT: "https://maduan.storage.supabase.co/storage/v1/s3", S3_FORCE_PATH_STYLE: "true" }).serverSideEncryption).toBeUndefined();
    expect(
      readS3Config({
        S3_BUCKET: "vcomm-tep",
        AWS_REGION: "ap-southeast-1",
        S3_ENDPOINT: "https://maduan.storage.supabase.co/storage/v1/s3",
        S3_FORCE_PATH_STYLE: "true",
        S3_SERVER_SIDE_ENCRYPTION: "none",
      }),
    ).toEqual({ bucket: "vcomm-tep", region: "ap-southeast-1", endpoint: "https://maduan.storage.supabase.co/storage/v1/s3", forcePathStyle: true, serverSideEncryption: undefined });
  });

  it("KICHBAN_KIEMTHU_841: giá trị sai thì nêu đủ tên biến", () => {
    expect(() => readS3Config({ S3_ENDPOINT: "maduan.storage.supabase.co", S3_FORCE_PATH_STYLE: "co", S3_SERVER_SIDE_ENCRYPTION: "aws:kms" })).toThrow(
      /thiếu S3_BUCKET; S3_ENDPOINT phải là địa chỉ đầy đủ.*; S3_FORCE_PATH_STYLE chỉ nhận true hoặc false; S3_SERVER_SIDE_ENCRYPTION chỉ nhận AES256 hoặc none/,
    );
  });

  it("KICHBAN_KIEMTHU_841: STORAGE_DRIVER=s3 thiếu S3_BUCKET thì báo lỗi khi tạo kho tệp", () => {
    process.env.STORAGE_DRIVER = "s3";
    delete process.env.S3_BUCKET;
    try {
      expect(() => createFileStorage()).toThrow(/thiếu S3_BUCKET/);
    } finally {
      delete process.env.STORAGE_DRIVER;
    }
  });
});

describe("CONG_VIEC_79 tải lên, tải xuống qua kho tương thích S3", () => {
  // Đúng bộ biến môi trường thật của CONG_VIEC_76 (không đặt S3_SERVER_SIDE_ENCRYPTION).
  const supabaseStorage = (overrides: Partial<Parameters<typeof readS3Config>[0]> = {}) =>
    new S3FileStorage(readS3Config({ S3_BUCKET: "vcomm-tep", AWS_REGION: "ap-southeast-1", S3_ENDPOINT: endpoint, S3_FORCE_PATH_STYLE: "true", ...overrides }));

  it("KICHBAN_KIEMTHU_839: đường dẫn kiểu /bucket/khóa, không gửi tiêu đề mã hóa, tải xuống đúng nội dung, xóa được", async () => {
    const storage = supabaseStorage();
    const content = Buffer.from("Nội dung tệp đính kèm thử");
    await storage.put("company-1/proposal-2/abc", content, "application/pdf");
    const upload = requests.find((item) => item.method === "PUT")!;
    expect(upload.url.split("?")[0]).toBe("/storage/v1/s3/vcomm-tep/company-1/proposal-2/abc");
    expect(upload.headers["x-amz-server-side-encryption"]).toBeUndefined();
    expect(upload.headers["content-type"]).toBe("application/pdf");
    expect(upload.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=khoa-truy-cap-gia\/\d{8}\/ap-southeast-1\/s3\//);
    expect(upload.headers["x-amz-checksum-crc32"]).toBeUndefined();

    expect((await storage.get("company-1/proposal-2/abc")).equals(content)).toBe(true);
    await storage.remove("company-1/proposal-2/abc");
    expect(requests.map((item) => item.method)).toEqual(["PUT", "GET", "DELETE"]);
    await expect(storage.get("company-1/proposal-2/abc")).rejects.toThrow();
  });

  it("KICHBAN_KIEMTHU_839: đặt S3_SERVER_SIDE_ENCRYPTION=AES256 thì kho khác AWS vẫn nhận tiêu đề mã hóa", async () => {
    await supabaseStorage({ S3_SERVER_SIDE_ENCRYPTION: "AES256" }).put("company-1/a", Buffer.from("x"), "text/plain");
    expect(requests[0]!.headers["x-amz-server-side-encryption"]).toBe("AES256");
  });

  it("KICHBAN_KIEMTHU_842: khóa lưu trữ không hợp lệ bị từ chối trước khi gọi kho", async () => {
    await expect(supabaseStorage().put("../ngoai", Buffer.from("x"), "text/plain")).rejects.toThrow(/Khóa lưu trữ không hợp lệ/);
    expect(requests).toHaveLength(0);
  });
});

describe("CONG_VIEC_79 cấu hình AWS S3 cũ gửi yêu cầu như trước", () => {
  it("KICHBAN_KIEMTHU_840: địa chỉ amazonaws.com theo tên miền bucket, có tiêu đề mã hóa AES256", async () => {
    const storage = new S3FileStorage(readS3Config({ S3_BUCKET: "vcomm-tep", AWS_REGION: "ap-southeast-1" }));
    const client = (storage as unknown as { client: S3Client }).client;
    let captured: { hostname: string; path: string; headers: Record<string, string> } | undefined;
    // Chặn ở bước cuối, trả phản hồi giả, không gọi mạng AWS.
    client.middlewareStack.add(
      (() => async (args: { request: unknown }) => {
        captured = args.request as typeof captured;
        return { response: { statusCode: 200, headers: {} }, output: {} };
      }) as never,
      { step: "deserialize", priority: "low" },
    );
    await storage.put("company-1/b", Buffer.from("x"), "text/plain");
    expect(captured?.hostname).toBe("vcomm-tep.s3.ap-southeast-1.amazonaws.com");
    expect(captured?.path).toBe("/company-1/b");
    expect(captured?.headers["x-amz-server-side-encryption"]).toBe("AES256");
  });
});
