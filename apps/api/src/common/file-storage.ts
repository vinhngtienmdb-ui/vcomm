// Lưu nội dung tệp đính kèm (QUYTAC_NGHIEPVU_35): AWS S3 khi STORAGE_DRIVER=s3 (tài liệu 12), thư mục cục bộ khi phát triển.
// Biến môi trường: STORAGE_DRIVER (local | s3), STORAGE_DIRECTORY, S3_BUCKET, AWS_REGION.
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

export class S3FileStorage implements FileStorage {
  private readonly client = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  private readonly bucket = process.env.S3_BUCKET ?? "";

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: content, ContentType: contentType, ServerSideEncryption: "AES256" }));
  }

  async get(key: string): Promise<Buffer> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    return Buffer.from(await object.Body!.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }
}

export function createFileStorage(): FileStorage {
  return process.env.STORAGE_DRIVER === "s3" ? new S3FileStorage() : new LocalFileStorage();
}
