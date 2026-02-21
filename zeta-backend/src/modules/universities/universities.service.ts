import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { University } from './entities/university.entity';
import { AcademicOffer } from './entities/academic-offer.entity';

@Injectable()
export class UniversitiesService {
    constructor(
        @InjectRepository(University)
        private readonly uniRepo: Repository<University>,
        @InjectRepository(AcademicOffer)
        private readonly offerRepo: Repository<AcademicOffer>,
    ) { }

    // Lista universidades (para dropdown del registro/onboarding)
    async findAll() {
        return this.uniRepo.find({
            order: { name: 'ASC' },
        });
    }

    // Carreras de una universidad (para dropdown del onboarding paso 2)
    async getOffersByUniversity(universityId: string) {
        return this.offerRepo.find({
            where: { university_id: universityId, status: 'activa' },
            relations: ['career'],
            order: { career: { name: 'ASC' } },
        });
    }

    // Todas las ofertas académicas (uni + carrera combinadas)
    async getAllOffers() {
        return this.offerRepo.find({
            where: { status: 'activa' },
            relations: ['university', 'career'],
        });
    }
}