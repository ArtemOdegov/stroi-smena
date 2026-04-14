import { IsUUID } from 'class-validator';

export class CreateDirectDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  peerUserId: string;
}
