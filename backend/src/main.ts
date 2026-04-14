import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.PORT) || 3000;
  try {
    await app.listen(port);
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'EADDRINUSE') {
      process.stderr.write(
        `[Nest] Порт ${port} занят (часто уже запущен nest start). В каталоге backend: npm run free:api-port — затем снова npm run dev:stack\n`,
      );
    }
    throw err;
  }
}
bootstrap();
