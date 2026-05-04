import { IsIn, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(['DIRECTOR', 'MASTER', 'EMPLOYEE'])
  role?: 'DIRECTOR' | 'MASTER' | 'EMPLOYEE';

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'INACTIVE'])
  status?: 'ACTIVE' | 'PENDING' | 'INACTIVE';
}
