import { IsIn, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(['DIRECTOR', 'EMPLOYEE'])
  role?: 'DIRECTOR' | 'EMPLOYEE';

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'INACTIVE'])
  status?: 'ACTIVE' | 'PENDING' | 'INACTIVE';
}
