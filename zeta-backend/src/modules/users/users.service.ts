import {
    Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Interest } from '../interests/entities/interest.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
    ) { }

    // ── Obtener perfil propio (con todas las relaciones) ──
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

    // ── Actualizar perfil (onboarding paso 2 + edición posterior) ──
    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: ['interests'],
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');

        // Campos simples
        if (dto.name !== undefined) user.name = dto.name;
        if (dto.photo !== undefined) user.photo = dto.photo;
        if (dto.academic_offer_id !== undefined) user.academic_offer_id = dto.academic_offer_id;
        if (dto.year !== undefined) user.year = dto.year;
        if (dto.privacy !== undefined) user.privacy = dto.privacy;

        // Intereses — reemplaza todos si se envían
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

        // Devolver con relaciones completas
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
}