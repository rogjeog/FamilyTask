import { IsEnum } from 'class-validator';

export class ChangeMemberRoleDto {
  @IsEnum(['PARENT', 'CHILD', 'OTHER'])
  role: 'PARENT' | 'CHILD' | 'OTHER';
}
