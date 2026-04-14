import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateDirectDto } from './dto/create-direct.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  conversations(
    @CurrentUser() user: AuthUser,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.chat.listConversations(user.userId, companyId);
  }

  @Post('conversations/direct')
  @UseGuards(JwtAuthGuard)
  async direct(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDirectDto,
  ) {
    return this.chat.getOrCreateDirect(
      user.userId,
      dto.companyId,
      dto.peerUserId,
    );
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  messages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chat.listMessages(user.userId, conversationId, cursor);
  }

  @Post('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  async send(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const msg = await this.chat.sendMessage(
      user.userId,
      conversationId,
      dto.body,
      dto.attachmentUrl,
      dto.attachmentType,
    );
    this.gateway.emitMessage(conversationId, msg);
    return msg;
  }

  @Post('conversations/:conversationId/read')
  @UseGuards(JwtAuthGuard)
  read(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chat.markRead(user.userId, conversationId);
  }
}
