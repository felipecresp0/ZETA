import {
    IsEmail, IsNotEmpty, MinLength, IsOptional,
    IsInt, Min, Max, IsArray, IsString
} from 'class-validator';

export class RegisterDto {
    @IsNotEmpty()
    @IsString()
    name: string;                  // "Sergio Casamayor"

    @IsEmail()
    email: string;                 // "a28602@svalero.com"

    @MinLength(8)
    password: string;

    @IsOptional()
    @IsString()
    academic_offer_id?: string;    // Se asigna en el paso 2 del onboarding

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    year?: number;                 // 1º, 2º, 3º...

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interest_ids?: string[];       // UUIDs de intereses seleccionados
}