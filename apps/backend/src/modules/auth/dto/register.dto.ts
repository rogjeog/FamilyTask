import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères' })
  password: string;

  @IsString()
  @MinLength(1, { message: 'Le nom affiché est requis' })
  @MaxLength(60, { message: 'Le nom affiché ne peut pas dépasser 60 caractères' })
  @Transform(({ value }: { value: string }) => value?.trim())
  displayName: string;
}
