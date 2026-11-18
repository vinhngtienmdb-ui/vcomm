// Lưu nội dung tệp đính kèm (QUYTAC_NGHIEPVU_35): kho S3 khi STORAGE_DRIVER=s3 (tài liệu 12), thư mục cục bộ khi phát triển.
// Biến môi trường: STORAGE_DRIVER (local | s3), STORAGE_DIRECTORY, S3_BUCKET, AWS_REGION; kho tương thích S3 khác AWS
// (Supabase Storage, CONG_VIEC_79): S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_SERVER_SIDE_ENCRYPTION. Khóa truy cập: AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY (SDK tự đọc) hoặc vai trò IAM.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const FILE_STORAGE = Symbol("FILE_STORAGE");

export interface FileStorage {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

// Khóa lưu trữ do hệ thống sinh (công ty/đề xuất/mã ngẫu nhiên), không chứa tên tệp người dùng.
const safeKey = (key: string) => {
  if (!/^[a-z0-9/-]+$/.test(key) || key.includes("..")) throw new Error("Khóa lưu trữ không hợp lệ");
  return key;
};

export class LocalFileStorage implements FileStorage {
  private readonly root = resolve(process.env.STORAGE_DIRECTORY || join(process.cwd(), ".storage"));

  async put(key: string, content: Buffer): Promise<void> {
    const path = join(this.root, safeKey(key));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(this.root, safeKey(key)));
  }

  async remove(key: string): Promise<void> {
    await rm(join(this.root, safeKey(key)), { force: true });
  }
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  forcePathStyle: boolean;
  serverSideEncryption: "AES256" | undefined;
}

// Không đặt S3_ENDPOINT thì giữ đúng cấu hình AWS S3 cũ (mã hóa AES256 phía máy chủ). Có S3_ENDPOINT (kho khác AWS) thì mặc định
// không gửi tiêu đề mã hóa AWS vì chưa xác minh nhà cung cấp nhận; S3_SERVER_SIDE_ENCRYPTION (AES256 | none) ghi đè mặc định.
// Lỗi nêu tên biến, không in giá trị.
export function readS3Config(environment: NodeJS.ProcessEnv = process.env): S3StorageConfig {
  const problems: string[] = [];
  const bucket = environment.S3_BUCKET?.trim() ?? "";
  if (!bucket) problems.push("thiếu S3_BUCKET");
  const endpoint = environment.S3_ENDPOINT?.trim() || undefined;
  if (endpoint && !URL.canParse(endpoint)) problems.push("S3_ENDPOINT phải là địa chỉ đầy đủ, ví dụ https://<máy chủ>/storage/v1/s3");
  const pathStyleText = environment.S3_FORCE_PATH_STYLE?.trim() || "false";
  if (pathStyleText !== "true" && pathStyleText !== "false") problems.push("S3_FORCE_PATH_STYLE chỉ nhận true hoặc false");
  const encryptionText = environment.S3_SERVER_SIDE_ENCRYPTION?.trim() || (endpoint ? "none" : "AES256");
  if (encryptionText !== "AES256" && encryptionText !== "none") problems.push("S3_SERVER_SIDE_ENCRYPTION chỉ nhận AES256 hoặc none");
  if (problems.length > 0) throw new Error(`Cấu hình lưu tệp S3 chưa đúng: ${problems.join("; ")}.`);
  return {
    bucket,
    region: environment.AWS_REGION?.trim() || "ap-southeast-1",
    endpoint,
    forcePathStyle: pathStyleText === "true",
    serverSideEncryption: encryptionText === "AES256" ? "AES256" : undefined,
  };
}

export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig = readS3Config()) {
    this.client = new S3Client({
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      // Kho tương thích S3 khác AWS có thể không nhận tổng kiểm tra mặc định của SDK; chỉ gửi khi thao tác bắt buộc.
      ...(config.endpoint ? { endpoint: config.endpoint, requestChecksumCalculation: "WHEN_REQUIRED" as const, responseChecksumValidation: "WHEN_REQUIRED" as const } : {}),
    });
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: safeKey(key),
        Body: content,
        ContentType: contentType,
        ...(this.config.serverSideEncryption ? { ServerSideEncryption: this.config.serverSideEncryption } : {}),
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: safeKey(key) }));
    return Buffer.from(await object.Body!.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: safeKey(key) }));
  }
}

export function createFileStorage(): FileStorage {
  return process.env.STORAGE_DRIVER === "s3" ? new S3FileStorage() : new LocalFileStorage();
}
