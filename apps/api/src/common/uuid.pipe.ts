// Mã trong đường dẫn không phải UUID thì trả 404 như bản ghi không tồn tại (tài liệu 17 mục 1).
import { Injectable, type PipeTransform } from "@nestjs/common";
import { z } from "zod";
import { ApiError } from "./api-error";

const uuid = z.uuid();

@Injectable()
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuid.safeParse(value).success) throw new ApiError("NOT_FOUND", "notFound");
    return value;
  }
}
