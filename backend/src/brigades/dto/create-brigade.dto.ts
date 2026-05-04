import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBrigadeDto {
  @IsUUID()
  masterUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  memberUserIds: string[];
}
