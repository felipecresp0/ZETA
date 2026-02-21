import {
    IsOptional, IsString, IsInt, Min, Max,
    IsArray, IsIn
} from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    photo?: string;

    @IsOptional()
    @IsString()
    academic_offer_id?: string;    // Vincula universidad + carrera

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    year?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interest_ids?: string[];       // Reemplaza todos los intereses

    @IsOptional()
    @IsIn(['public', 'university', 'career'])
    privacy?: string;
}