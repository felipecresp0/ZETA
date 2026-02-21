import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, ManyToMany, JoinColumn, JoinTable,
    CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { AcademicOffer } from '../../universities/entities/academic-offer.entity';
import { Interest } from '../../interests/entities/interest.entity';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    email: string;             // email@unizar.es — validado contra dominio

    @Column()
    @Exclude()                 // Nunca se serializa en respuestas JSON
    password: string;

    @Column({ nullable: true })
    photo: string;             // URL foto perfil

    @Column({ type: 'int', default: 1 })
    year: number;              // 1º, 2º, 3º, 4º

    @Column({ default: 'public' })
    privacy: string;           // public | university | career

    // ── Relación con Oferta Académica (Universidad + Carrera) ──
    @ManyToOne(() => AcademicOffer, { eager: true, nullable: true })
    @JoinColumn({ name: 'academic_offer_id' })
    academicOffer: AcademicOffer;

    @Column({ nullable: true })
    academic_offer_id?: string;

    // ── Intereses (N:M) ──
    @ManyToMany(() => Interest, { eager: true })
    @JoinTable({
        name: 'user_interests',
        joinColumn: { name: 'user_id' },
        inverseJoinColumn: { name: 'interest_id' },
    })
    interests: Interest[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}