import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { BrigadesService } from './brigades.service';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';

@Controller('companies/:companyId/brigades')
@UseGuards(JwtAuthGuard)
export class BrigadesController {
  constructor(private readonly brigades: BrigadesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.brigades.list(user.userId, companyId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateBrigadeDto,
  ) {
    return this.brigades.create(user.userId, companyId, dto);
  }

  @Patch(':brigadeId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('brigadeId', ParseUUIDPipe) brigadeId: string,
    @Body() dto: UpdateBrigadeDto,
  ) {
    return this.brigades.update(user.userId, companyId, brigadeId, dto);
  }

  @Delete(':brigadeId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('brigadeId', ParseUUIDPipe) brigadeId: string,
  ) {
    return this.brigades.delete(user.userId, companyId, brigadeId);
  }
}
