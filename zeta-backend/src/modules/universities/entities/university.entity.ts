import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { AcademicOffer } from './academic-offer.entity';

@Entity('universities')
export class University {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;              // "Universidad de Zaragoza"

    @Column({ unique: true })
    domain_email: string;      // "unizar.es" — para validar registro

    @Column({ nullable: true })
    acronym: string;           // "UniZar"

    @Column({ nullable: true })
    logo: string;              // URL del logo

    @OneToMany(() => AcademicOffer, (offer) => offer.university)
    offers: AcademicOffer[];
}