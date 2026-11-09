import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { ApiErrorFilter } from "./common/api-error";
import { AuditService } from "./common/audit.service";
import { DatabaseModule } from "./database/database.module";
import { HomeController } from "./home/home.controller";
import { MeController } from "./me/me.controller";
import { PermissionService } from "./permissions/permission.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController, HomeController],
  providers: [
    AuthService,
    AuditService,
    PermissionService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class AppModule {}
