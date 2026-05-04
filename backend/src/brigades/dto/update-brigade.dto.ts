import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateBrigadeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  masterUserId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberUserIds?: string[];
}
