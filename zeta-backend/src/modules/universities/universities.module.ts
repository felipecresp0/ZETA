import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { University } from './entities/university.entity';
import { Career } from './entities/career.entity';
import { AcademicOffer } from './entities/academic-offer.entity';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
    imports: [TypeOrmModule.forFeature([University, Career, AcademicOffer])],
    controllers: [UniversitiesController],
    providers: [UniversitiesService],
    exports: [UniversitiesService],
})
export class UniversitiesModule { }