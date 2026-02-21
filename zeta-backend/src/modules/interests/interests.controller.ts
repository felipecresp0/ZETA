import { Controller, Get } from '@nestjs/common';
import { InterestsService } from './interests.service';

@Controller('interests')
export class InterestsController {
    constructor(private readonly interestsService: InterestsService) { }

    // GET /api/interests — Lista plana de todos los intereses
    @Get()
    async findAll() {
        return this.interestsService.findAll();
    }

    // GET /api/interests/grouped — Agrupados por categoría
    @Get('grouped')
    async findGrouped() {
        return this.interestsService.findGrouped();
    }
}