import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateEventDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString()
    event_date?: string;

    @IsOptional()
    @IsString()
    location?: string;
}