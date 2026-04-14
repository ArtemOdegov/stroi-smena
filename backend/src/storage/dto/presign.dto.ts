import { IsString, MinLength } from 'class-validator';

export class PresignDto {
  @IsString()
  @MinLength(3)
  contentType: string;

  @IsString()
  @MinLength(1)
  extension: string;
}
