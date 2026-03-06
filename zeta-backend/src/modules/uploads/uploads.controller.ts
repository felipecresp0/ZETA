// src/modules/uploads/uploads.controller.ts
import {
    Controller, Post, Delete, Body,
    UseGuards, UseInterceptors, UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) {}

    @Post('photo')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
                cb(new BadRequestException('Solo se permiten imágenes JPG, PNG o WEBP'), false);
            }
            cb(null, true);
        },
    }))
    async uploadPhoto(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser('id') userId: string,
    ) {
        if (!file) throw new BadRequestException('No se ha enviado ninguna imagen');
        return this.uploadsService.uploadPhoto(file, userId);
    }

    @Delete('photo')
    async deletePhoto(
        @Body('url') url: string,
        @CurrentUser('id') userId: string,
    ) {
        const photos = await this.uploadsService.deletePhoto(url, userId);
        return { message: 'Foto eliminada', photos };
    }
}