import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn
} from 'typeorm';
import { University } from './university.entity';
import { Career } from './career.entity';

@Entity('academic_offers')
export class AcademicOffer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => University, (uni) => uni.offers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'university_id' })
    university: University;

    @Column()
    university_id: string;

    @ManyToOne(() => Career, (career) => career.offers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'career_id' })
    career: Career;

    @Column()
    career_id: string;

    @Column({ default: 'presencial' })
    modality: string;          // presencial | online | híbrido

    @Column({ default: 'activa' })
    status: string;            // activa | inactiva
}