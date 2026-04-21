import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { FamiliesModule } from './modules/families/families.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, AuthModule, FamiliesModule, TasksModule],
  providers: [
    {
      // All routes are JWT-protected by default.
      // Mark exceptions with @Public() from auth/decorators/public.decorator.ts
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
