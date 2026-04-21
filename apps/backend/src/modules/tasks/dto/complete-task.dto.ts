import { IsOptional, IsUrl } from 'class-validator';

export class CompleteTaskDto {
  @IsOptional()
  @IsUrl()
  proofUrl?: string;
}
