import { IsString, MinLength } from 'class-validator';

export class JoinCompanyDto {
  @IsString()
  @MinLength(4)
  code: string;
}
