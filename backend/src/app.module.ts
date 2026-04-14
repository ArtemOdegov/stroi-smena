import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { StorageModule } from './storage/storage.module';
import { DayEntriesModule } from './day-entries/day-entries.module';
import { ChatModule } from './chat/chat.module';
import { PushModule } from './push/push.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PushModule,
    AuthModule,
    CompaniesModule,
    StorageModule,
    DayEntriesModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
