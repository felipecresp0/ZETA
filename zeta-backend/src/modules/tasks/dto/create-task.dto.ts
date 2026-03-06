import {
    IsNotEmpty, IsOptional, IsString,
    IsIn, IsDateString, IsNumber, Min,
} from 'class-validator';

export class CreateTaskDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsDateString()
    due_date?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    estimated_hours?: number;

    @IsOptional()
    @IsIn(['high', 'medium', 'low'])
    priority?: string;

    @IsOptional()
    @IsString()
    group_id?: string;
}
