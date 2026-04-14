import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationType,
  MembershipRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { JoinCompanyDto } from './dto/join-company.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

const COMPANY_DIRECT_KEY = '__company__';

function randomInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(userId: string, companyId: string) {
    const m = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });
    if (!m || m.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Not a member of this company');
    }
    return m;
  }

  async assertDirector(userId: string, companyId: string) {
    const m = await this.assertMember(userId, companyId);
    if (m.role !== MembershipRole.DIRECTOR) {
      throw new ForbiddenException('Director only');
    }
    return m;
  }

  async create(userId: string, dto: CreateCompanyDto) {
    const code = await this.uniqueInviteCode();
    const company = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.create({
        data: {
          name: dto.name,
          ownerId: userId,
        },
      });
      await tx.membership.create({
        data: {
          userId,
          companyId: c.id,
          role: MembershipRole.DIRECTOR,
          status: MembershipStatus.ACTIVE,
        },
      });
      await tx.inviteCode.create({
        data: { code, companyId: c.id, active: true },
      });
      const conv = await tx.conversation.create({
        data: {
          companyId: c.id,
          type: ConversationType.COMPANY,
          directKey: COMPANY_DIRECT_KEY,
          title: dto.name,
        },
      });
      await tx.conversationMember.create({
        data: { conversationId: conv.id, userId },
      });
      return c;
    });
    return { company, inviteCode: code };
  }

  private async uniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = randomInviteCode();
      const exists = await this.prisma.inviteCode.findUnique({
        where: { code },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('Could not generate invite code');
  }

  async join(userId: string, dto: JoinCompanyDto) {
    const code = dto.code.trim().toUpperCase();
    const invite = await this.prisma.inviteCode.findFirst({
      where: {
        code,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { company: true },
    });
    if (!invite) {
      throw new NotFoundException('Invalid or expired invite code');
    }
    const existing = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId, companyId: invite.companyId },
      },
    });
    if (existing) {
      if (existing.status === MembershipStatus.INACTIVE) {
        throw new ForbiddenException('Membership inactive');
      }
      return { companyId: invite.companyId, alreadyMember: true };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          userId,
          companyId: invite.companyId,
          role: MembershipRole.EMPLOYEE,
          status: MembershipStatus.ACTIVE,
        },
      });
      await tx.inviteRedemption.create({
        data: { inviteCodeId: invite.id, userId },
      });
      const companyConv = await tx.conversation.findFirst({
        where: {
          companyId: invite.companyId,
          type: ConversationType.COMPANY,
          directKey: COMPANY_DIRECT_KEY,
        },
      });
      if (companyConv) {
        await tx.conversationMember.upsert({
          where: {
            conversationId_userId: {
              conversationId: companyConv.id,
              userId,
            },
          },
          create: { conversationId: companyConv.id, userId },
          update: {},
        });
      }
    });
    return { companyId: invite.companyId, alreadyMember: false };
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: {
        company: {
          include: {
            inviteCodes: {
              where: { active: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    return memberships.map((m) => ({
      companyId: m.companyId,
      role: m.role,
      companyName: m.company.name,
      inviteCode:
        m.role === MembershipRole.DIRECTOR
          ? m.company.inviteCodes[0]?.code ?? null
          : null,
    }));
  }

  async listColleagues(userId: string, companyId: string) {
    await this.assertMember(userId, companyId);
    const members = await this.prisma.membership.findMany({
      where: {
        companyId,
        status: MembershipStatus.ACTIVE,
        userId: { not: userId },
      },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((x) => ({
      userId: x.userId,
      email: x.user.email,
      name: x.user.name,
      role: x.role,
    }));
  }

  async listMembers(directorUserId: string, companyId: string) {
    await this.assertDirector(directorUserId, companyId);
    const members = await this.prisma.membership.findMany({
      where: { companyId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((x) => ({
      userId: x.userId,
      email: x.user.email,
      name: x.user.name,
      role: x.role,
      status: x.status,
      joinedAt: x.createdAt,
    }));
  }

  async updateMember(
    directorUserId: string,
    companyId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ) {
    await this.assertDirector(directorUserId, companyId);
    if (targetUserId === directorUserId) {
      throw new BadRequestException('Cannot change own membership this way');
    }
    const target = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId: targetUserId, companyId },
      },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    const data: Prisma.MembershipUpdateInput = {};
    if (dto.role) data.role = dto.role;
    if (dto.status) data.status = dto.status;
    return this.prisma.membership.update({
      where: { id: target.id },
      data,
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async regenerateInvite(directorUserId: string, companyId: string) {
    await this.assertDirector(directorUserId, companyId);
    const newCode = await this.uniqueInviteCode();
    await this.prisma.$transaction([
      this.prisma.inviteCode.updateMany({
        where: { companyId, active: true },
        data: { active: false },
      }),
      this.prisma.inviteCode.create({
        data: { code: newCode, companyId, active: true },
      }),
    ]);
    return { inviteCode: newCode };
  }
}
