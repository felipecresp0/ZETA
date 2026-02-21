import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class CreateGroupDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsIn(['general', 'carrera', 'interés', 'estudio'])
    type?: string;

    @IsOptional()
    @IsIn(['public', 'university', 'private'])
    privacy?: string;
}