import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { BrigadesController } from './brigades.controller';
import { BrigadesService } from './brigades.service';

@Module({
  imports: [CompaniesModule],
  controllers: [BrigadesController],
  providers: [BrigadesService],
})
export class BrigadesModule {}
