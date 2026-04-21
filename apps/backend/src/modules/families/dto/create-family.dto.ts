import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;
}
