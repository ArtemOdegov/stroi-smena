import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';

@Injectable()
export class BrigadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  private async membershipRows(companyId: string, userIds: string[]) {
    if (!userIds.length) return [];
    return this.prisma.membership.findMany({
      where: {
        companyId,
        userId: { in: userIds },
        status: MembershipStatus.ACTIVE,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  private async assertActiveMaster(companyId: string, userId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (
      !m ||
      m.status !== MembershipStatus.ACTIVE ||
      m.role !== MembershipRole.MASTER
    ) {
      throw new BadRequestException('Мастер должен быть активным участником с ролью MASTER');
    }
  }

  private async assertActiveEmployees(companyId: string, userIds: string[]) {
    if (!userIds.length) return;
    const rows = await this.membershipRows(companyId, userIds);
    if (rows.length !== userIds.length) {
      throw new BadRequestException('Все участники бригады должны быть активными сотрудниками (EMPLOYEE)');
    }
    for (const r of rows) {
      if (r.role !== MembershipRole.EMPLOYEE) {
        throw new BadRequestException('В бригаду можно добавлять только сотрудников с ролью EMPLOYEE');
      }
    }
  }

  private async assertNotInOtherBrigade(
    companyId: string,
    userIds: string[],
    excludeBrigadeId?: string,
  ) {
    if (!userIds.length) return;
    const clash = await this.prisma.brigadeMember.findFirst({
      where: {
        userId: { in: userIds },
        brigade: { companyId },
        ...(excludeBrigadeId
          ? { brigadeId: { not: excludeBrigadeId } }
          : {}),
      },
      include: { brigade: true },
    });
    if (clash) {
      throw new BadRequestException('Один из сотрудников уже состоит в другой бригаде');
    }
  }

  private async toDto(
    b: Prisma.BrigadeGetPayload<{
      include: {
        master: { select: { id: true; name: true } };
        members: { include: { user: { select: { id: true; email: true; name: true } } } };
      };
    }>,
    companyId: string,
  ) {
    const userIds = b.members.map((m) => m.userId);
    const mems = await this.membershipRows(companyId, userIds);
    const byUser = new Map(mems.map((m) => [m.userId, m]));
    return {
      id: b.id,
      companyId: b.companyId,
      name: b.name,
      masterUserId: b.masterId,
      masterName: b.master.name,
      members: b.members.map((row) => {
        const mm = byUser.get(row.userId);
        return {
          userId: row.userId,
          email: row.user.email,
          name: row.user.name,
          role: mm?.role ?? 'EMPLOYEE',
          status: mm?.status ?? MembershipStatus.ACTIVE,
          joinedAt: mm?.createdAt.toISOString() ?? new Date(0).toISOString(),
        };
      }),
    };
  }

  async list(actorUserId: string, companyId: string) {
    const m = await this.companies.assertMember(actorUserId, companyId);
    const where: Prisma.BrigadeWhereInput = { companyId };
    if (m.role === MembershipRole.MASTER) {
      where.masterId = actorUserId;
    } else if (m.role !== MembershipRole.DIRECTOR) {
      throw new ForbiddenException('Только директор или мастер');
    }
    const rows = await this.prisma.brigade.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        master: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    return Promise.all(rows.map((r) => this.toDto(r, companyId)));
  }

  async create(actorUserId: string, companyId: string, dto: CreateBrigadeDto) {
    await this.companies.assertDirector(actorUserId, companyId);
    if (dto.memberUserIds.includes(dto.masterUserId)) {
      throw new BadRequestException('Мастер не должен быть в списке сотрудников бригады');
    }
    await this.assertActiveMaster(companyId, dto.masterUserId);
    await this.assertActiveEmployees(companyId, dto.memberUserIds);
    await this.assertNotInOtherBrigade(companyId, dto.memberUserIds);
    const b = await this.prisma.$transaction(async (tx) => {
      const brigade = await tx.brigade.create({
        data: {
          companyId,
          name: dto.name?.trim() ?? '',
          masterId: dto.masterUserId,
        },
      });
      if (dto.memberUserIds.length) {
        await tx.brigadeMember.createMany({
          data: dto.memberUserIds.map((userId) => ({
            brigadeId: brigade.id,
            userId,
          })),
        });
      }
      return tx.brigade.findUniqueOrThrow({
        where: { id: brigade.id },
        include: {
          master: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });
    });
    return this.toDto(b, companyId);
  }

  private async getBrigadeOrThrow(companyId: string, brigadeId: string) {
    const b = await this.prisma.brigade.findFirst({
      where: { id: brigadeId, companyId },
      include: {
        master: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!b) throw new NotFoundException('Бригада не найдена');
    return b;
  }

  async update(
    actorUserId: string,
    companyId: string,
    brigadeId: string,
    dto: UpdateBrigadeDto,
  ) {
    const b = await this.getBrigadeOrThrow(companyId, brigadeId);
    const actor = await this.companies.assertMember(actorUserId, companyId);
    const isDirector = actor.role === MembershipRole.DIRECTOR;
    const isOwnMaster =
      actor.role === MembershipRole.MASTER && b.masterId === actorUserId;
    if (!isDirector && !isOwnMaster) {
      throw new ForbiddenException('Нет прав на изменение бригады');
    }
    if (!isDirector && (dto.masterUserId != null || dto.name !== undefined)) {
      throw new ForbiddenException('Мастер может менять только состав сотрудников');
    }
    if (dto.masterUserId != null && dto.masterUserId !== b.masterId) {
      await this.assertActiveMaster(companyId, dto.masterUserId);
    }
    if (dto.memberUserIds) {
      const masterId = dto.masterUserId ?? b.masterId;
      if (dto.memberUserIds.includes(masterId)) {
        throw new BadRequestException('Мастер не должен быть в списке сотрудников');
      }
      await this.assertActiveEmployees(companyId, dto.memberUserIds);
      await this.assertNotInOtherBrigade(companyId, dto.memberUserIds, brigadeId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.memberUserIds) {
        await tx.brigadeMember.deleteMany({ where: { brigadeId } });
        if (dto.memberUserIds.length) {
          await tx.brigadeMember.createMany({
            data: dto.memberUserIds.map((userId) => ({
              brigadeId,
              userId,
            })),
          });
        }
      }
      const data: Prisma.BrigadeUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.masterUserId != null) {
        data.master = { connect: { id: dto.masterUserId } };
      }
      if (Object.keys(data).length) {
        await tx.brigade.update({ where: { id: brigadeId }, data });
      }
      return tx.brigade.findUniqueOrThrow({
        where: { id: brigadeId },
        include: {
          master: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });
    });
    return this.toDto(updated, companyId);
  }

  async delete(actorUserId: string, companyId: string, brigadeId: string) {
    await this.companies.assertDirector(actorUserId, companyId);
    const n = await this.prisma.brigade.deleteMany({
      where: { id: brigadeId, companyId },
    });
    if (!n.count) throw new NotFoundException('Бригада не найдена');
    return { ok: true as const };
  }
}
