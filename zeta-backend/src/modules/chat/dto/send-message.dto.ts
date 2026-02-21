import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class SendMessageDto {
    @IsNotEmpty()
    @IsString()
    conversation_id: string;

    @IsNotEmpty()
    @IsString()
    content: string;

    @IsOptional()
    @IsIn(['text', 'image', 'file'])
    type?: string;

    @IsOptional()
    @IsString()
    attachment_url?: string;
}