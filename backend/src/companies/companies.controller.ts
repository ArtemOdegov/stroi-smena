import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { JoinCompanyDto } from './dto/join-company.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.companies.create(user.userId, dto);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinCompanyDto) {
    return this.companies.join(user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.companies.listForUser(user.userId);
  }

  @Get(':companyId/colleagues')
  @UseGuards(JwtAuthGuard)
  colleagues(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.companies.listColleagues(user.userId, companyId);
  }

  @Get(':companyId/members')
  @UseGuards(JwtAuthGuard)
  members(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.companies.listMembers(user.userId, companyId);
  }

  @Patch(':companyId/members/:userId')
  @UseGuards(JwtAuthGuard)
  patchMember(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.companies.updateMember(
      user.userId,
      companyId,
      targetUserId,
      dto,
    );
  }

  @Post(':companyId/invite/regenerate')
  @UseGuards(JwtAuthGuard)
  regenerateInvite(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.companies.regenerateInvite(user.userId, companyId);
  }
}
