import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger(PushService.name);
  private messaging: admin.messaging.Messaging | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) {
      this.log.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON не задан — отправка только на Expo Push Token (и только если токены с kind=expo).',
      );
      return;
    }
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(
            JSON.parse(raw) as admin.ServiceAccount,
          ),
        });
      }
      this.messaging = admin.messaging();
      this.log.log('FCM (firebase-admin) инициализирован.');
    } catch (e) {
      this.log.error(`FCM init failed: ${String(e)}`);
    }
  }

  /**
   * Уведомление одному пользователю на все зарегистрированные устройства.
   */
  async notifyUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const rows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, tokenKind: true },
    });
    if (!rows.length) return;

    const stringData = data
      ? Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        )
      : undefined;

    const expoRows = rows.filter((r) => r.tokenKind === 'expo');
    const fcmRows = rows.filter((r) => r.tokenKind !== 'expo');

    if (expoRows.length) {
      await this.sendExpoBatch(
        expoRows.map((r) => r.token),
        title,
        body,
        stringData,
      );
    }

    if (fcmRows.length && this.messaging) {
      const tokens = fcmRows.map((r) => r.token);
      try {
        const res = await this.messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: stringData,
        });
        if (res.failureCount > 0) {
          this.log.warn(
            `FCM: ${res.failureCount} ошибок из ${tokens.length} (см. ответы).`,
          );
        }
      } catch (e) {
        this.log.warn(`FCM sendEachForMulticast: ${String(e)}`);
      }
    } else if (fcmRows.length && !this.messaging) {
      this.log.debug(
        `Пропуск ${fcmRows.length} FCM-токенов: firebase не сконфигурирован.`,
      );
    }
  }

  private async sendExpoBatch(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 99) {
      chunks.push(tokens.slice(i, i + 99));
    }
    for (const chunk of chunks) {
      const messages = chunk.map((to) => ({
        to,
        sound: 'default' as const,
        title,
        body,
        data: data ?? {},
      }));
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          this.log.warn(`Expo push HTTP ${res.status}: ${await res.text()}`);
        }
      } catch (e) {
        this.log.warn(`Expo push: ${String(e)}`);
      }
    }
  }

  async notifyNewChatMessage(args: {
    conversationId: string;
    senderId: string;
    senderName: string;
    body: string;
    attachmentUrl: string | null;
  }) {
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversationId: args.conversationId,
        userId: { not: args.senderId },
      },
      select: { userId: true },
    });
    const snippet =
      args.body.trim() ||
      (args.attachmentUrl ? 'Вложение' : 'Новое сообщение');
    const title = args.senderName;
    const body = snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet;
    const data = {
      type: 'chat_message',
      conversationId: args.conversationId,
    };
    await Promise.all(
      members.map((m) =>
        this.notifyUser(m.userId, title, body, data).catch((e) =>
          this.log.debug(`push user ${m.userId}: ${String(e)}`),
        ),
      ),
    );
  }
}
