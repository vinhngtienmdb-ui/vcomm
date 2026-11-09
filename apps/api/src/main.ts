import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { vietnamDate } from "./common/clock";
import { DATABASE, type Database } from "./database/database.module";
import { startBackgroundJobs } from "./jobs/background-jobs";
import { syncPermissionCatalog } from "./permissions/permission-catalog";
import { AuditEventsService } from "./settings/audit-events.service";

export function configureApplication(application: NestExpressApplication): NestExpressApplication {
  application.setGlobalPrefix("api/v1");
  application.use(cookieParser());
  application.disable("x-powered-by");
  application.set("trust proxy", 1);
  return application;
}

async function bootstrap(): Promise<void> {
  const application = configureApplication(await NestFactory.create<NestExpressApplication>(AppModule));
  await syncPermissionCatalog(application.get<Database>(DATABASE));
  await application.get(AuditEventsService).ensurePartitions(vietnamDate(new Date()));
  application.enableShutdownHooks();
  const stopJobs = await startBackgroundJobs(application);
  process.once("SIGTERM", () => void stopJobs());
  await application.listen(Number(process.env.API_PORT ?? 4000));
}

if (require.main === module) {
  void bootstrap();
}
