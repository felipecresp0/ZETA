// src/modules/uploads/uploads.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UploadsService {
    private s3: S3Client;
    private bucket: string;
    private region: string;

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {
        this.bucket = process.env.AWS_S3_BUCKET || 'zeta-user-photos';
        this.region = process.env.AWS_S3_REGION || 'us-east-1';

        this.s3 = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                sessionToken: process.env.AWS_SESSION_TOKEN!,
            },
        });
    }

    async uploadPhoto(file: Express.Multer.File, userId: string): Promise<{ url: string; photos: string[] }> {
        const ext = file.originalname.split('.').pop();
        const key = `users/${userId}/${uuid()}.${ext}`;

        await this.s3.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));

        const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

        // Guardar en el usuario
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user) {
            user.photos = [...(user.photos || []), url];
            await this.userRepo.save(user);
        }

        return { url, photos: user?.photos || [url] };
    }

    async deletePhoto(url: string, userId: string): Promise<string[]> {
        // Borrar de S3
        const key = url.split('.amazonaws.com/')[1];
        if (key) {
            await this.s3.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
        }

        // Quitar del usuario
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user) {
            user.photos = (user.photos || []).filter(p => p !== url);
            await this.userRepo.save(user);
            return user.photos;
        }

        return [];
    }
}