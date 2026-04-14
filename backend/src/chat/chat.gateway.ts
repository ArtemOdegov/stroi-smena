import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.service';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth as { token?: string })?.token ??
      (typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (!raw) {
      client.disconnect(true);
      return;
    }
    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(raw, {
        secret: process.env.JWT_SECRET!,
      });
      client.data.userId = p.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const uid = client.data.userId as string;
    await this.chat.assertConversationMember(uid, body.conversationId);
    await client.join(`conv:${body.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; typing: boolean },
  ) {
    const uid = client.data.userId as string;
    await this.chat.assertConversationMember(uid, body.conversationId);
    client.to(`conv:${body.conversationId}`).emit('typing', {
      userId: uid,
      typing: body.typing,
    });
    return { ok: true };
  }

  emitMessage(conversationId: string, payload: unknown) {
    this.server.to(`conv:${conversationId}`).emit('message', payload);
  }
}
