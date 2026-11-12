// Nhận tệp tải lên của Văn phòng số: multer dừng ngay khi tệp vượt 20 MB hoặc quá số tệp, giới hạn bộ nhớ mỗi yêu cầu,
// và báo lỗi theo ô như kiểm tra ở dịch vụ (QUYTAC_NGHIEPVU_359).
import { BadRequestException, PayloadTooLargeException, type CallHandler, type ExecutionContext, type NestInterceptor, type Type } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { officeFileMaximumBytes } from "contracts";
import { catchError, type Observable } from "rxjs";
import { ApiError } from "../common/api-error";

// Số tệp tối đa mỗi lần vào sổ công văn đến: tối đa 5 × 20 MB trong bộ nhớ mỗi yêu cầu.
export const officeMaximumFilesPerUpload = 5;

const translate = (field: string) => (error: unknown) => {
  if (error instanceof PayloadTooLargeException) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "officeFileTooLarge" } });
  if (error instanceof BadRequestException && /too many files/i.test(error.message)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "officeTooManyFiles" } });
  throw error;
};

function wrap(inner: NestInterceptor, field: string): NestInterceptor {
  return {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        const result = await inner.intercept(context, next);
        return result.pipe(catchError(translate(field)));
      } catch (error) {
        return translate(field)(error);
      }
    },
  };
}

// Một tệp ở trường "file".
export function OfficeFileUpload(): Type<NestInterceptor> {
  const Inner = FileInterceptor("file", { limits: { fileSize: officeFileMaximumBytes, files: 1 } });
  class OfficeFileUploadInterceptor implements NestInterceptor {
    private readonly inner = wrap(new Inner(), "file");
    intercept(context: ExecutionContext, next: CallHandler) {
      return this.inner.intercept(context, next);
    }
  }
  return OfficeFileUploadInterceptor;
}

// Nhiều tệp ở trường "files" (vào sổ công văn đến).
export function OfficeFilesUpload(): Type<NestInterceptor> {
  const Inner = FilesInterceptor("files", officeMaximumFilesPerUpload, { limits: { fileSize: officeFileMaximumBytes, files: officeMaximumFilesPerUpload } });
  class OfficeFilesUploadInterceptor implements NestInterceptor {
    private readonly inner = wrap(new Inner(), "file");
    intercept(context: ExecutionContext, next: CallHandler) {
      return this.inner.intercept(context, next);
    }
  }
  return OfficeFilesUploadInterceptor;
}
