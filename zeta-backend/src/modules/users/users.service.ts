import {
    Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Interest } from '../interests/entities/interest.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import axios from 'axios';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
    ) { }

    async getMyProfile(userId: string): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: [
                'interests',
                'academicOffer',
                'academicOffer.university',
                'academicOffer.career',
            ],
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');
        return user;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: ['interests'],
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');

        if (dto.name !== undefined) user.name = dto.name;
        if (dto.photos !== undefined) user.photos = dto.photos;
        if (dto.academic_offer_id !== undefined) user.academic_offer_id = dto.academic_offer_id;
        if (dto.year !== undefined) user.year = dto.year;
        if (dto.privacy !== undefined) user.privacy = dto.privacy;

        if (dto.interest_ids !== undefined) {
            if (dto.interest_ids.length > 0) {
                user.interests = await this.interestRepo.findBy({
                    id: In(dto.interest_ids),
                });
            } else {
                user.interests = [];
            }
        }

        const saved = await this.userRepo.save(user);

        // ── Disparar matching IA si completó onboarding ──
        if (dto.interest_ids && dto.interest_ids.length > 0 && dto.academic_offer_id) {
            const n8nUrl = process.env.N8N_WEBHOOK_MATCHING || 'http://localhost:5678/webhook/matching';
            axios.post(n8nUrl, { user_id: userId })
                .catch(err => console.error('[Matching] Error al disparar n8n:', err.message));
        }

        return this.getMyProfile(userId);
    }

    // ── Ver perfil de otro usuario (respetando privacidad) ──
    async getUserProfile(targetId: string, requesterId: string): Promise<Partial<User>> {
        const target = await this.userRepo.findOne({
            where: { id: targetId },
            relations: [
                'interests',
                'academicOffer',
                'academicOffer.university',
                'academicOffer.career',
            ],
        });

        if (!target) throw new NotFoundException('Usuario no encontrado');

        // Si es público, devolver todo
        if (target.privacy === 'public') {
            return this.sanitize(target);
        }

        // Si es "university", comprobar que comparten universidad
        if (target.privacy === 'university') {
            const requester = await this.userRepo.findOne({
                where: { id: requesterId },
                relations: ['academicOffer'],
            });

            if (
                requester?.academicOffer?.university_id &&
                target.academicOffer?.university_id &&
                requester.academicOffer.university_id === target.academicOffer.university_id
            ) {
                return this.sanitize(target);
            }

            throw new ForbiddenException('Este perfil solo es visible para estudiantes de su universidad');
        }

        // Si es "career", comprobar que comparten oferta académica
        if (target.privacy === 'career') {
            const requester = await this.userRepo.findOne({
                where: { id: requesterId },
            });

            if (
                requester?.academic_offer_id &&
                target.academic_offer_id &&
                requester.academic_offer_id === target.academic_offer_id
            ) {
                return this.sanitize(target);
            }

            throw new ForbiddenException('Este perfil solo es visible para compañeros de carrera');
        }

        return this.sanitize(target);
    }

    // ── Elimina password de la respuesta ──
    private sanitize(user: User) {
        const { password, ...result } = user;
        return result;
    }

    async updatePushToken(userId: string, pushToken: string) {
    await this.userRepo.update(userId, { push_token: pushToken });
    return { message: 'Push token guardado' };
    }
}