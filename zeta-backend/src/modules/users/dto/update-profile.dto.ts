import {
    IsOptional, IsString, IsInt, Min, Max,
    IsArray, IsIn
} from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    photos?: string[];

    @IsOptional()
    @IsString()
    academic_offer_id?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(6)
    year?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interest_ids?: string[];

    @IsOptional()
    @IsIn(['public', 'university', 'career'])
    privacy?: string;
}