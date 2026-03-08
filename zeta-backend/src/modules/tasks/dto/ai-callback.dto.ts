import { IsNotEmpty, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class AiCallbackDto {
    @IsNotEmpty()
    @IsString()
    task_id: string;

    @IsNotEmpty()
    @IsIn(['low', 'medium', 'high', 'urgent'])
    priority: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    estimated_hours: number;
}
