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
    email: string;

    @Column()
    @Exclude()
    password: string;

    @Column('text', { array: true, default: '{}' })
    photos: string[];          // URLs de fotos de perfil (mínimo 2 en onboarding)

    @Column({ type: 'int', default: 1 })
    year: number;

    @Column({ default: 'public' })
    privacy: string;

    @Column({ nullable: true })
    push_token: string;

    @ManyToOne(() => AcademicOffer, { eager: true, nullable: true })
    @JoinColumn({ name: 'academic_offer_id' })
    academicOffer: AcademicOffer;

    @Column({ nullable: true })
    academic_offer_id?: string;

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