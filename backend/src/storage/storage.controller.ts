import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { PresignDto } from './dto/presign.dto';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.storage.presignPut(
      user.userId,
      dto.contentType,
      dto.extension,
    );
  }
}
