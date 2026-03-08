import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateEventDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsDateString()
    event_date: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsString()
    group_id?: string;
}