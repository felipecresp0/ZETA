import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { AcademicOffer } from './academic-offer.entity';

@Entity('careers')
export class Career {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;              // "Ingeniería Informática"

    @Column({ nullable: true })
    knowledge_area: string;    // "Ingeniería y Arquitectura"

    @OneToMany(() => AcademicOffer, (offer) => offer.career)
    offers: AcademicOffer[];
}