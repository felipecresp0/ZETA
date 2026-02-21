import {
    Injectable, BadRequestException,
    UnauthorizedException, ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { University } from '../universities/entities/university.entity';
import { Interest } from '../interests/entities/interest.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(University)
        private readonly uniRepo: Repository<University>,
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
        private readonly jwtService: JwtService,
    ) { }

    // ── REGISTRO ──
    async register(dto: RegisterDto) {
        // 1. Extraer dominio del email
        const domain = dto.email.split('@')[1];
        if (!domain) {
            throw new BadRequestException('Email inválido');
        }

        // 2. Validar que el dominio pertenece a una universidad registrada
        const university = await this.uniRepo.findOne({
            where: { domain_email: domain },
        });

        if (!university) {
            throw new BadRequestException(
                `El dominio @${domain} no está asociado a ninguna universidad registrada. ` +
                `Debes usar tu correo institucional para registrarte.`
            );
        }

        // 3. Verificar que el email no esté ya registrado
        const exists = await this.userRepo.findOne({
            where: { email: dto.email.toLowerCase() },
        });

        if (exists) {
            throw new ConflictException('Ya existe una cuenta con este email');
        }

        // 4. Hash de la contraseña
        const hashedPassword = await bcrypt.hash(dto.password, 12);

        // 5. Cargar intereses si se proporcionaron
        let interests: Interest[] = [];
        if (dto.interest_ids?.length) {
            interests = await this.interestRepo.findBy({
                id: In(dto.interest_ids),
            });
        }

        // 6. Crear usuario
        const user = this.userRepo.create({
            name: dto.name,
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            academic_offer_id: dto.academic_offer_id || undefined,
            year: dto.year || 1,
            interests,
        });

        const saved = await this.userRepo.save(user);

        // 7. Generar JWT (save devuelve User, no array, al pasar un solo objeto)
        const token = this.generateToken(saved as User);

        return {
            user: this.sanitizeUser(saved as User),
            access_token: token,
            university: {
                id: university.id,
                name: university.name,
                acronym: university.acronym,
            },
        };
    }

    // ── LOGIN ──
    async login(email: string, password: string) {
        const user = await this.userRepo.findOne({
            where: { email: email.toLowerCase() },
            relations: ['interests', 'academicOffer', 'academicOffer.university', 'academicOffer.career'],
        });

        if (!user) {
            throw new UnauthorizedException('Credenciales incorrectas');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            throw new UnauthorizedException('Credenciales incorrectas');
        }

        const token = this.generateToken(user);

        return {
            user: this.sanitizeUser(user),
            access_token: token,
        };
    }

    // ── Validar usuario para LocalStrategy ──
    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userRepo.findOne({
            where: { email: email.toLowerCase() },
        });

        if (user && await bcrypt.compare(password, user.password)) {
            return user;
        }
        return null;
    }

    // ── Helpers ──
    private generateToken(user: User): string {
        return this.jwtService.sign({
            sub: user.id,
            email: user.email,
        });
    }

    private sanitizeUser(user: User) {
        // Elimina password y devuelve el resto
        const { password, ...result } = user;
        return result;
    }
}