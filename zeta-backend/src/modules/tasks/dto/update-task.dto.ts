import {
    IsOptional, IsString, IsBoolean,
    IsIn, IsDateString, IsNumber, Min,
} from 'class-validator';

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    title?: string;

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
    @IsIn(['pending', 'in_progress', 'done'])
    status?: string;

    @IsOptional()
    @IsString()
    group_id?: string;

    @IsOptional()
    @IsBoolean()
    ai_pioritized?: boolean;
}
