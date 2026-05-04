import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GeoSource, MembershipRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpsertDayEntryDto } from './dto/upsert-day-entry.dto';

@Injectable()
export class DayEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async assertCanAccessCompany(userId: string, companyId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!m || m.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Not a member');
    }
    return m;
  }

  private parseDay(dateStr: string): Date {
    const d = new Date(dateStr + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) {
      throw new NotFoundException('Invalid date');
    }
    return d;
  }

  private entryInclude() {
    return {
      photos: { orderBy: { sortOrder: 'asc' as const } },
      user: { select: { name: true, email: true } },
    };
  }

  /** Все записи компании за период; любой активный участник видит дни коллег. Директор может сузить по userId. */
  async list(
    userId: string,
    companyId: string,
    from: string,
    to: string,
    filterUserId?: string,
  ) {
    const m = await this.assertCanAccessCompany(userId, companyId);
    const fromD = this.parseDay(from);
    const toD = this.parseDay(to);

    const canFilterByUser =
      m.role === MembershipRole.DIRECTOR || m.role === MembershipRole.MASTER;
    if (canFilterByUser && filterUserId?.trim()) {
      const fid = filterUserId.trim();
      if (fid !== userId) {
        const other = await this.prisma.membership.findUnique({
          where: { userId_companyId: { userId: fid, companyId } },
        });
        if (!other || other.status !== MembershipStatus.ACTIVE) {
          throw new NotFoundException('User not in company');
        }
      }
      const rows = await this.prisma.dayEntry.findMany({
        where: {
          companyId,
          userId: fid,
          date: { gte: fromD, lte: toD },
        },
        include: this.entryInclude(),
        orderBy: { date: 'asc' },
      });
      return Promise.all(rows.map((e) => this.mapEntry(e)));
    }

    const rows = await this.prisma.dayEntry.findMany({
      where: {
        companyId,
        date: { gte: fromD, lte: toD },
      },
      include: this.entryInclude(),
      orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    });
    return Promise.all(rows.map((e) => this.mapEntry(e)));
  }

  /** Все записи за календарный день (чтение для любого участника компании). */
  async listForDate(userId: string, companyId: string, dateStr: string) {
    await this.assertCanAccessCompany(userId, companyId);
    const date = this.parseDay(dateStr);
    const rows = await this.prisma.dayEntry.findMany({
      where: { companyId, date },
      include: this.entryInclude(),
      orderBy: { userId: 'asc' },
    });
    return Promise.all(rows.map((e) => this.mapEntry(e)));
  }

  async getOneForDirector(
    directorUserId: string,
    companyId: string,
    targetUserId: string,
    dateStr: string,
  ) {
    const m = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId: directorUserId, companyId },
      },
    });
    if (!m || m.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException();
    }
    if (
      m.role !== MembershipRole.DIRECTOR &&
      m.role !== MembershipRole.MASTER
    ) {
      throw new ForbiddenException('Director or master only');
    }
    const date = this.parseDay(dateStr);
    const entry = await this.prisma.dayEntry.findUnique({
      where: {
        userId_companyId_date: {
          userId: targetUserId,
          companyId,
          date,
        },
      },
      include: this.entryInclude(),
    });
    return entry ? await this.mapEntry(entry) : null;
  }

  private async mapEntry(
    e: {
      id: string;
      userId: string;
      user?: { name: string | null; email: string | null } | null;
      date: Date;
      notes: string;
      version: number;
      lat: number | null;
      lng: number | null;
      geoSource: GeoSource | null;
      geoAccuracy: number | null;
      geoCapturedAt: Date | null;
      updatedAt: Date;
      photos: { id: string; storageKey: string; sortOrder: number }[];
    } | null,
  ) {
    if (!e) return null;
    const authorName =
      e.user?.name?.trim() || e.user?.email?.trim() || undefined;
    const photos = await Promise.all(
      e.photos.map(async (p) => ({
        id: p.id,
        storageKey: p.storageKey,
        url: await this.storage.presignGetObject(p.storageKey),
        sortOrder: p.sortOrder,
      })),
    );
    return {
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      userId: e.userId,
      authorName,
      notes: e.notes,
      version: e.version,
      lat: e.lat,
      lng: e.lng,
      geoSource: e.geoSource,
      geoAccuracy: e.geoAccuracy,
      geoCapturedAt: e.geoCapturedAt?.toISOString() ?? null,
      photos,
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  async upsert(
    userId: string,
    companyId: string,
    dateStr: string,
    dto: UpsertDayEntryDto,
  ) {
    await this.assertCanAccessCompany(userId, companyId);
    const date = this.parseDay(dateStr);

    if (dto.clientMutationId) {
      const dup = await this.prisma.dayEntry.findUnique({
        where: { clientMutationId: dto.clientMutationId },
      });
      if (dup && dup.userId === userId && dup.companyId === companyId) {
        const full = await this.prisma.dayEntry.findUnique({
          where: { id: dup.id },
          include: this.entryInclude(),
        });
        return await this.mapEntry(full!);
      }
    }

    const existing = await this.prisma.dayEntry.findUnique({
      where: {
        userId_companyId_date: { userId, companyId, date },
      },
      include: { photos: true },
    });

    if (
      existing &&
      dto.expectedVersion != null &&
      existing.version !== dto.expectedVersion
    ) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        serverVersion: existing.version,
      });
    }

    const geoSource = dto.geoSource
      ? (dto.geoSource as keyof typeof GeoSource)
      : undefined;
    const geoCapturedAt = dto.geoCapturedAt
      ? new Date(dto.geoCapturedAt)
      : undefined;

    const saved = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.dayEntry.upsert({
        where: {
          userId_companyId_date: { userId, companyId, date },
        },
        create: {
          userId,
          companyId,
          date,
          notes: dto.notes ?? '',
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          geoSource: geoSource ? GeoSource[geoSource] : null,
          geoAccuracy: dto.geoAccuracy ?? null,
          geoCapturedAt: geoCapturedAt ?? null,
          clientMutationId: dto.clientMutationId ?? null,
          version: 1,
        },
        update: {
          notes: dto.notes,
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          geoSource: geoSource ? GeoSource[geoSource] : null,
          geoAccuracy: dto.geoAccuracy ?? null,
          geoCapturedAt: geoCapturedAt ?? null,
          clientMutationId: dto.clientMutationId ?? undefined,
          version: { increment: 1 },
        },
      });

      if (dto.photos !== undefined) {
        await tx.dayEntryPhoto.deleteMany({ where: { dayEntryId: entry.id } });
        let order = 0;
        for (const p of dto.photos) {
          await tx.dayEntryPhoto.create({
            data: {
              dayEntryId: entry.id,
              storageKey: p.storageKey,
              url: this.storage.keyToPublicUrl(p.storageKey),
              sortOrder: order++,
            },
          });
        }
      }

      return tx.dayEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: this.entryInclude(),
      });
    });

    return await this.mapEntry(saved);
  }
}
