import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { DayEntriesService } from './day-entries.service';
import { UpsertDayEntryDto } from './dto/upsert-day-entry.dto';

@Controller('companies')
export class DayEntriesController {
  constructor(private readonly dayEntries: DayEntriesService) {}

  @Get(':companyId/day-entries')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') filterUserId?: string,
  ) {
    return this.dayEntries.list(
      user.userId,
      companyId,
      from,
      to,
      filterUserId,
    );
  }

  @Get(':companyId/day-entries/by-user/:targetUserId/:date')
  @UseGuards(JwtAuthGuard)
  getForUser(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Param('date') date: string,
  ) {
    return this.dayEntries.getOneForDirector(
      user.userId,
      companyId,
      targetUserId,
      date,
    );
  }

  @Get(':companyId/day-entries/:date')
  @UseGuards(JwtAuthGuard)
  getForDate(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('date') date: string,
  ) {
    return this.dayEntries.listForDate(user.userId, companyId, date);
  }

  @Put(':companyId/day-entries/:date')
  @UseGuards(JwtAuthGuard)
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('date') date: string,
    @Body() dto: UpsertDayEntryDto,
  ) {
    return this.dayEntries.upsert(user.userId, companyId, date, dto);
  }
}
