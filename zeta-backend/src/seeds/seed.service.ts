import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { University } from '../modules/universities/entities/university.entity';
import { Career } from '../modules/universities/entities/career.entity';
import { AcademicOffer } from '../modules/universities/entities/academic-offer.entity';
import { Interest } from '../modules/interests/entities/interest.entity';

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        @InjectRepository(University)
        private readonly uniRepo: Repository<University>,
        @InjectRepository(Career)
        private readonly careerRepo: Repository<Career>,
        @InjectRepository(AcademicOffer)
        private readonly offerRepo: Repository<AcademicOffer>,
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
    ) { }

    async run() {
        await this.seedUniversities();
        await this.seedCareers();
        await this.seedAcademicOffers();
        await this.seedInterests();
        this.logger.log('Seed completado correctamente');
    }

    // ── Universidades ──
    private async seedUniversities() {
        const universities = [
            // === PRUEBAS DESARROLLO ===
            {
                name: 'Centro San Valero',
                domain_email: 'svalero.com',
                acronym: 'CSV',
                logo: undefined,
            },
            // === DEMO TRIBUNAL ===
            {
                name: 'Universidad Demo Zeta',
                domain_email: 'zetapp.es',
                acronym: 'UDZ',
                logo: undefined,
            },
            // === PRODUCCIÓN FUTURA (descomentar cuando tengáis acuerdos) ===
            // {
            //   name: 'Universidad de Zaragoza',
            //   domain_email: 'unizar.es',
            //   acronym: 'UniZar',
            //   logo: null,
            // },
            // {
            //   name: 'Universidad San Jorge',
            //   domain_email: 'usj.es',
            //   acronym: 'USJ',
            //   logo: null,
            // },
        ];

        for (const uni of universities) {
            const exists = await this.uniRepo.findOne({
                where: { domain_email: uni.domain_email },
            });
            if (!exists) {
                await this.uniRepo.save(this.uniRepo.create(uni));
                this.logger.log(`Universidad creada: ${uni.name} (@${uni.domain_email})`);
            }
        }
    }

    // ── Carreras (genéricas, no ligadas a uni) ──
    private async seedCareers() {
        const careers = [
            { name: 'Ingeniería Informática', knowledge_area: 'Ingeniería y Arquitectura' },
            { name: 'Desarrollo de Aplicaciones Multiplataforma', knowledge_area: 'Informática' },
            { name: 'Desarrollo de Aplicaciones Web', knowledge_area: 'Informática' },
            { name: 'Administración y Dirección de Empresas', knowledge_area: 'Ciencias Sociales' },
            { name: 'Derecho', knowledge_area: 'Ciencias Sociales' },
            { name: 'Medicina', knowledge_area: 'Ciencias de la Salud' },
            { name: 'Arquitectura', knowledge_area: 'Ingeniería y Arquitectura' },
            { name: 'Psicología', knowledge_area: 'Ciencias de la Salud' },
            { name: 'Periodismo', knowledge_area: 'Ciencias Sociales' },
            { name: 'Marketing y Comunicación Digital', knowledge_area: 'Ciencias Sociales' },
        ];

        for (const c of careers) {
            const exists = await this.careerRepo.findOne({ where: { name: c.name } });
            if (!exists) {
                await this.careerRepo.save(this.careerRepo.create(c));
                this.logger.log(`Carrera creada: ${c.name}`);
            }
        }
    }

    // ── Ofertas Académicas (vincula uni + carrera) ──
    private async seedAcademicOffers() {
        // CSV ofrece DAM y DAW
        const csv = await this.uniRepo.findOne({ where: { domain_email: 'svalero.com' } });
        const udz = await this.uniRepo.findOne({ where: { domain_email: 'zetapp.es' } });

        const dam = await this.careerRepo.findOne({ where: { name: 'Desarrollo de Aplicaciones Multiplataforma' } });
        const daw = await this.careerRepo.findOne({ where: { name: 'Desarrollo de Aplicaciones Web' } });
        const ingInf = await this.careerRepo.findOne({ where: { name: 'Ingeniería Informática' } });
        const ade = await this.careerRepo.findOne({ where: { name: 'Administración y Dirección de Empresas' } });

        const offers = [
            // San Valero ofrece DAM y DAW
            { university: csv, career: dam, modality: 'presencial' },
            { university: csv, career: daw, modality: 'presencial' },
            // Demo Zeta ofrece Ing. Informática y ADE (para que el tribunal vea variedad)
            { university: udz, career: ingInf, modality: 'presencial' },
            { university: udz, career: ade, modality: 'presencial' },
            { university: udz, career: dam, modality: 'presencial' },
        ];

        for (const o of offers) {
            if (!o.university || !o.career) continue;

            const exists = await this.offerRepo.findOne({
                where: {
                    university_id: o.university.id,
                    career_id: o.career.id,
                },
            });

            if (!exists) {
                await this.offerRepo.save(this.offerRepo.create({
                    university: o.university,
                    university_id: o.university.id,
                    career: o.career,
                    career_id: o.career.id,
                    modality: o.modality,
                    status: 'activa',
                }));
                this.logger.log(`Oferta: ${o.career.name} en ${o.university.name}`);
            }
        }
    }

    // ── Intereses (los que salen en el prototipo del PDF) ──
    private async seedInterests() {
        const interests = [
            // Deportes
            { name: 'Fútbol', category: 'Deportes', icon: '⚽' },
            { name: 'Baloncesto', category: 'Deportes', icon: '🏀' },
            { name: 'Running', category: 'Deportes', icon: '🏃' },
            { name: 'Gimnasio', category: 'Deportes', icon: '💪' },
            { name: 'Pádel', category: 'Deportes', icon: '🎾' },
            // Ocio y entretenimiento
            { name: 'Gaming', category: 'Ocio', icon: '🎮' },
            { name: 'Series', category: 'Ocio', icon: '📺' },
            { name: 'Música', category: 'Ocio', icon: '🎵' },
            { name: 'Cine', category: 'Ocio', icon: '🎬' },
            { name: 'Viajes', category: 'Ocio', icon: '✈️' },
            // Cultura y formación
            { name: 'Lectura', category: 'Cultura', icon: '📚' },
            { name: 'Fotografía', category: 'Cultura', icon: '📷' },
            { name: 'Arte', category: 'Cultura', icon: '🎨' },
            // Tecnología
            { name: 'Programación', category: 'Tecnología', icon: '💻' },
            { name: 'Inteligencia Artificial', category: 'Tecnología', icon: '🤖' },
            { name: 'Diseño UI/UX', category: 'Tecnología', icon: '🎯' },
            // Social
            { name: 'Voluntariado', category: 'Social', icon: '🤝' },
            { name: 'Networking', category: 'Social', icon: '🔗' },
            { name: 'Cocina', category: 'Social', icon: '👨‍🍳' },
            { name: 'Mates', category: 'Académico', icon: '📐' },
        ];

        for (const i of interests) {
            const exists = await this.interestRepo.findOne({ where: { name: i.name } });
            if (!exists) {
                await this.interestRepo.save(this.interestRepo.create(i));
                this.logger.log(`Interés creado: ${i.icon} ${i.name}`);
            }
        }
    }
}