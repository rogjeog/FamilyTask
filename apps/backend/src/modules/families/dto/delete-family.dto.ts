import { IsString, MinLength } from 'class-validator';

export class DeleteFamilyDto {
  @IsString()
  @MinLength(1)
  confirmationName: string;
}
