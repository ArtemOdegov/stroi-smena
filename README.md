# СтройСмена

Мобильное приложение для учёта смен на стройке. Сотрудник отмечает день, прикладывает фото и геометку. Мастер видит бригаду, директор — компанию целиком. Если на объекте нет сети, отчёт сохраняется на телефоне и уходит на сервер, когда связь появляется.

## Что внутри

- Роли: директор, мастер, сотрудник. Вход в компанию по инвайт-коду.
- Бригады: мастер и состав.
- Табель: заметка за день, фото с объекта, координаты (авто или точка на карте).
- Офлайн-очередь на телефоне и повторная отправка.
- Чат компании и личные сообщения (Socket.IO).
- Push-токены.
- Веб-кабинет: календарь, сотрудники, карта отметок.

## Стек

| Часть | Технологии |
| --- | --- |
| Мобильное приложение | Expo, React Native, React Navigation |
| API | NestJS, Prisma, JWT |
| Данные | PostgreSQL, Redis |
| Файлы | MinIO (S3-совместимое хранилище, presigned URL) |
| Веб | Vite, React, Leaflet |

## Демо-аккаунты

Пароль у всех: `demo1234`

| Email | Роль |
| --- | --- |
| `director@demo.local` | Директор |
| `master@demo.local` | Мастер бригады |
| `worker@demo.local` | Сотрудник |

Инвайт в компанию «СеверСтрой»: `STROIDEMO`

## Запуск

Нужны Docker, Node.js 20 и для телефона — Expo Go.

```bash
docker compose up -d
cd backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3000`, проверка: `GET /health`.

Веб-кабинет:

```bash
cd web
npm ci
npm run dev
```

Мобильное приложение (из каталога `mobile`, в одном Wi‑Fi с компьютером):

```bash
cd mobile
npm ci
npx expo start
```

На реальном телефоне API подхватывается с хоста Metro. Явный адрес: `EXPO_PUBLIC_API_URL=http://<ip-компьютера>:3000`.

## Структура

```
backend/   NestJS API, Prisma, чат, загрузка фото
mobile/    Expo-приложение
web/       кабинет директора
```
