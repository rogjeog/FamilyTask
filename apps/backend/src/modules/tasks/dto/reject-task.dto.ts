import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
