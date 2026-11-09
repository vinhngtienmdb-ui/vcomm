// Mô hình lỗi theo tài liệu 17 mục 1.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { ErrorBody, ErrorCode } from "contracts";
import type { Request, Response } from "express";
import { messages, resolveLocale, type Messages } from "i18n";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

type ErrorMessageKey = keyof Messages["errors"];

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT_VERSION: 409,
  BUSINESS_RULE: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly messageKey: ErrorMessageKey,
    readonly extra: { fields?: Record<string, ErrorMessageKey>; retryAfterSeconds?: number } = {},
  ) {
    super(messageKey);
  }
}

// Thiếu giá trị (không gửi hoặc chuỗi rỗng) thì báo "Vui lòng nhập", còn lại báo giá trị không hợp lệ.
function isMissing(issue: ZodError["issues"][number]): boolean {
  if (issue.code === "invalid_type") return issue.message.endsWith("received undefined");
  return issue.code === "too_small" && issue.origin === "string" && Number(issue.minimum) === 1;
}

export function localeOf(request: Request): "vi" | "en" {
  return resolveLocale(request.header("accept-language"));
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiError");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const text = messages[localeOf(request)].errors;
    const requestId = (request.header("x-request-id") as string | undefined) ?? randomUUID();

    let code: ErrorCode = "INTERNAL";
    let body: ErrorBody["error"];
    if (exception instanceof ApiError) {
      code = exception.code;
      body = { code, message: text[exception.messageKey], requestId };
      if (exception.extra.fields) {
        body.fields = Object.fromEntries(Object.entries(exception.extra.fields).map(([field, key]) => [field, text[key]]));
      }
      if (exception.extra.retryAfterSeconds !== undefined) body.retryAfterSeconds = exception.extra.retryAfterSeconds;
    } else if (exception instanceof ZodError) {
      code = "VALIDATION_FAILED";
      const fields = Object.fromEntries(exception.issues.map((issue) => [issue.path.join(".") || "_", isMissing(issue) ? text.required : text.invalidValue]));
      body = { code, message: text.validationFailed, fields, requestId };
    } else if (exception instanceof HttpException && exception.getStatus() === 404) {
      code = "NOT_FOUND";
      body = { code, message: text.notFound, requestId };
    } else {
      // Chi tiết kỹ thuật chỉ ghi log, không trả cho người dùng (tài liệu 22, phần B mục 9).
      this.logger.error(`${requestId} ${(exception as Error)?.stack ?? String(exception)}`);
      body = { code, message: text.internal, requestId };
    }
    if (body.retryAfterSeconds !== undefined) response.setHeader("Retry-After", String(body.retryAfterSeconds));
    response.status(statusByCode[code]).json({ error: body } satisfies ErrorBody);
  }
}
