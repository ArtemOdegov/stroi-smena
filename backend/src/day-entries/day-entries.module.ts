import { Module } from '@nestjs/common';
import { DayEntriesService } from './day-entries.service';
import { DayEntriesController } from './day-entries.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [DayEntriesController],
  providers: [DayEntriesService],
  exports: [DayEntriesService],
})
export class DayEntriesModule {}
