import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ConversationType,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const COMPANY_DIRECT_KEY = '__company__';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async assertConversationMember(userId: string, conversationId: string) {
    const m = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      include: { conversation: true },
    });
    if (!m) {
      throw new ForbiddenException('Not in conversation');
    }
    return m;
  }

  async assertCompanyMember(userId: string, companyId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!m || m.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Not a company member');
    }
    return m;
  }

  async listConversations(userId: string, companyId: string) {
    await this.assertCompanyMember(userId, companyId);
    const convs = await this.prisma.conversation.findMany({
      where: {
        companyId,
        members: { some: { userId } },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const result = [];
    for (const c of convs) {
      const last = c.messages[0];
      let title = c.title || 'Чат';
      if (c.type === ConversationType.DIRECT) {
        const peerMember = await this.prisma.conversationMember.findFirst({
          where: { conversationId: c.id, userId: { not: userId } },
        });
        if (peerMember) {
          const u = await this.prisma.user.findUnique({
            where: { id: peerMember.userId },
            select: { name: true },
          });
          title = u?.name || 'Личный чат';
        }
      }
      result.push({
        id: c.id,
        type: c.type,
        title,
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              senderId: last.senderId,
              senderName: last.sender.name,
            }
          : null,
      });
    }
    return result;
  }

  async getOrCreateDirect(
    userId: string,
    companyId: string,
    peerUserId: string,
  ) {
    if (userId === peerUserId) {
      throw new ForbiddenException('Cannot chat with yourself');
    }
    await this.assertCompanyMember(userId, companyId);
    await this.assertCompanyMember(peerUserId, companyId);
    const a = userId < peerUserId ? userId : peerUserId;
    const b = userId < peerUserId ? peerUserId : userId;
    const directKey = `${a}:${b}`;
    let conv = await this.prisma.conversation.findUnique({
      where: {
        companyId_directKey: { companyId, directKey },
      },
    });
    if (!conv) {
      conv = await this.prisma.$transaction(async (tx) => {
        const c = await tx.conversation.create({
          data: {
            companyId,
            type: ConversationType.DIRECT,
            directKey,
            title: null,
          },
        });
        await tx.conversationMember.createMany({
          data: [
            { conversationId: c.id, userId },
            { conversationId: c.id, userId: peerUserId },
          ],
          skipDuplicates: true,
        });
        return c;
      });
    }
    return { conversationId: conv.id };
  }

  async listMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    take = 50,
  ) {
    await this.assertConversationMember(userId, conversationId);
    const where: Prisma.MessageWhereInput = { conversationId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { sender: { select: { id: true, name: true } } },
    });
    return rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      attachmentUrl: m.attachmentUrl,
      attachmentType: m.attachmentType,
      createdAt: m.createdAt.toISOString(),
      senderId: m.senderId,
      senderName: m.sender.name,
    }));
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
    attachmentUrl?: string,
    attachmentType?: string,
  ) {
    await this.assertConversationMember(userId, conversationId);
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body,
        attachmentUrl: attachmentUrl ?? null,
        attachmentType: attachmentType ?? null,
      },
      include: { sender: { select: { id: true, name: true } } },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return {
      id: msg.id,
      body: msg.body,
      attachmentUrl: msg.attachmentUrl,
      attachmentType: msg.attachmentType,
      createdAt: msg.createdAt.toISOString(),
      senderId: msg.senderId,
      senderName: msg.sender.name,
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertConversationMember(userId, conversationId);
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }
}
