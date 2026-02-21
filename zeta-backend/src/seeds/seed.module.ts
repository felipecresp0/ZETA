import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { University } from '../modules/universities/entities/university.entity';
import { Career } from '../modules/universities/entities/career.entity';
import { AcademicOffer } from '../modules/universities/entities/academic-offer.entity';
import { Interest } from '../modules/interests/entities/interest.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([University, Career, AcademicOffer, Interest]),
    ],
    providers: [SeedService],
    exports: [SeedService],
})
export class SeedModule { }