import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class PhotoRefDto {
  @IsString()
  storageKey: string;
}

export class UpsertDayEntryDto {
  @IsString()
  notes: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsEnum(['MANUAL', 'AUTO'])
  geoSource?: 'MANUAL' | 'AUTO';

  @IsOptional()
  @IsNumber()
  geoAccuracy?: number;

  @IsOptional()
  @IsDateString()
  geoCapturedAt?: string;

  @IsOptional()
  @IsString()
  clientMutationId?: string;

  @IsOptional()
  @IsNumber()
  expectedVersion?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoRefDto)
  photos?: PhotoRefDto[];
}
