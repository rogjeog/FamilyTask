import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class JoinFamilyDto {
  @IsString()
  @Length(6, 6)
  @Transform(({ value }: { value: string }) => value?.trim().toUpperCase())
  inviteCode: string;
}
