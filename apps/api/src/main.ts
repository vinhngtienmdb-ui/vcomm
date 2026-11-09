import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { DATABASE, type Database } from "./database/database.module";
import { syncPermissionCatalog } from "./permissions/permission-catalog";

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
  application.enableShutdownHooks();
  await application.listen(Number(process.env.API_PORT ?? 4000));
}

if (require.main === module) {
  void bootstrap();
}
