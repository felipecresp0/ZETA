import { Controller, Get, Param } from '@nestjs/common';
import { UniversitiesService } from './universities.service';

@Controller('universities')
export class UniversitiesController {
    constructor(private readonly universitiesService: UniversitiesService) { }

    // GET /api/universities — Lista todas las universidades
    @Get()
    async findAll() {
        return this.universitiesService.findAll();
    }

    // GET /api/universities/:id/offers — Carreras de una universidad
    @Get(':id/offers')
    async getOffers(@Param('id') universityId: string) {
        return this.universitiesService.getOffersByUniversity(universityId);
    }

    // GET /api/universities/offers/all — Todas las ofertas
    @Get('offers/all')
    async getAllOffers() {
        return this.universitiesService.getAllOffers();
    }
}