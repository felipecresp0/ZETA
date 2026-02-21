import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest } from './entities/interest.entity';

@Injectable()
export class InterestsService {
    constructor(
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
    ) { }

    // Lista todos los intereses (para chips del onboarding)
    async findAll() {
        return this.interestRepo.find({
            order: { category: 'ASC', name: 'ASC' },
        });
    }

    // Intereses por categoría (para agrupar en el UI)
    async findGrouped() {
        const all = await this.interestRepo.find({
            order: { category: 'ASC', name: 'ASC' },
        });

        // Agrupa por categoría: { "Deportes": [...], "Ocio": [...] }
        const grouped: Record<string, Interest[]> = {};
        for (const interest of all) {
            if (!grouped[interest.category]) {
                grouped[interest.category] = [];
            }
            grouped[interest.category].push(interest);
        }

        return grouped;
    }
}