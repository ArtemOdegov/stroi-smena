import {
  ConversationType,
  GeoSource,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'demo1234';
const COMPANY_NAME = 'ООО «СеверСтрой»';
const INVITE_CODE = 'STROIDEMO';
const COMPANY_CHAT_KEY = '__company__';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const director = await upsertUser(
    'director@demo.local',
    'Анна Соколова',
    passwordHash,
  );
  const master = await upsertUser(
    'master@demo.local',
    'Игорь Петров',
    passwordHash,
  );
  const worker = await upsertUser(
    'worker@demo.local',
    'Марат Алиев',
    passwordHash,
  );

  let company = await prisma.company.findFirst({
    where: { ownerId: director.id, name: COMPANY_NAME },
  });

  if (!company) {
    company = await prisma.company.create({
      data: { name: COMPANY_NAME, ownerId: director.id },
    });
  }

  const members: { userId: string; role: MembershipRole }[] = [
    { userId: director.id, role: MembershipRole.DIRECTOR },
    { userId: master.id, role: MembershipRole.MASTER },
    { userId: worker.id, role: MembershipRole.EMPLOYEE },
  ];

  for (const member of members) {
    await prisma.membership.upsert({
      where: {
        userId_companyId: { userId: member.userId, companyId: company.id },
      },
      update: { role: member.role, status: MembershipStatus.ACTIVE },
      create: {
        userId: member.userId,
        companyId: company.id,
        role: member.role,
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  await prisma.inviteCode.upsert({
    where: { code: INVITE_CODE },
    update: { companyId: company.id, active: true, expiresAt: null },
    create: { code: INVITE_CODE, companyId: company.id, active: true },
  });

  const brigade = await prisma.brigade.upsert({
    where: {
      companyId_masterId: { companyId: company.id, masterId: master.id },
    },
    update: { name: 'Бригада монолита' },
    create: {
      companyId: company.id,
      masterId: master.id,
      name: 'Бригада монолита',
    },
  });

  await prisma.brigadeMember.upsert({
    where: {
      brigadeId_userId: { brigadeId: brigade.id, userId: worker.id },
    },
    update: {},
    create: { brigadeId: brigade.id, userId: worker.id },
  });

  const entries: {
    userId: string;
    days: number;
    notes: string;
    lat: number;
    lng: number;
  }[] = [
    {
      userId: worker.id,
      days: 0,
      notes: 'Заливка плиты перекрытия, секция Б. Опалубка снята.',
      lat: 55.7512,
      lng: 37.6184,
    },
    {
      userId: worker.id,
      days: 1,
      notes: 'Кладка перегородок, 2 этаж. Расход блока по норме.',
      lat: 55.752,
      lng: 37.6191,
    },
    {
      userId: worker.id,
      days: 3,
      notes: 'Простой до 11:00: не привезли раствор. Дальше кладка.',
      lat: 55.7504,
      lng: 37.6172,
    },
    {
      userId: master.id,
      days: 0,
      notes: 'Приёмка арматуры. Узел колонны К-4 — фото в отчёте.',
      lat: 55.7518,
      lng: 37.6188,
    },
  ];

  for (const entry of entries) {
    const date = daysAgo(entry.days);
    await prisma.dayEntry.upsert({
      where: {
        userId_companyId_date: {
          userId: entry.userId,
          companyId: company.id,
          date,
        },
      },
      update: {
        notes: entry.notes,
        lat: entry.lat,
        lng: entry.lng,
        geoSource: GeoSource.MANUAL,
        geoCapturedAt: date,
      },
      create: {
        companyId: company.id,
        userId: entry.userId,
        date,
        notes: entry.notes,
        lat: entry.lat,
        lng: entry.lng,
        geoSource: GeoSource.MANUAL,
        geoCapturedAt: date,
      },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      companyId: company.id,
      type: ConversationType.COMPANY,
      directKey: COMPANY_CHAT_KEY,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        companyId: company.id,
        type: ConversationType.COMPANY,
        directKey: COMPANY_CHAT_KEY,
        title: COMPANY_NAME,
      },
    });
  }

  for (const userId of [director.id, master.id, worker.id]) {
    await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId },
      },
      update: {},
      create: { conversationId: conversation.id, userId },
    });
  }

  const messageCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });

  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: master.id,
          body: 'Сегодня бетонируем секцию Б. Бетон на площадке к 9:00.',
        },
        {
          conversationId: conversation.id,
          senderId: worker.id,
          body: 'Опалубку сняли, можно принимать.',
        },
        {
          conversationId: conversation.id,
          senderId: director.id,
          body: 'Принято. Фото узла приложите в отчёт за день.',
        },
      ],
    });
  }

  console.log('Демо-данные готовы.');
  console.log(`Компания: ${COMPANY_NAME}`);
  console.log(`Инвайт: ${INVITE_CODE}`);
  console.log('Пароль у всех: ' + PASSWORD);
  console.log('director@demo.local — директор');
  console.log('master@demo.local — мастер');
  console.log('worker@demo.local — сотрудник');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
