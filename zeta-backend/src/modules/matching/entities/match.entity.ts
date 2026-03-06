import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn, Unique, Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('matches')
@Unique(['user_id', 'matched_user_id'])
@Check('"user_id" != "matched_user_id"')
export class Match {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'matched_user_id' })
    matchedUser: User;

    @Column()
    matched_user_id: string;

    @Column({ type: 'int', default: 0 })
    affinity_score: number;

    @Column('text', { array: true, default: '{}' })
    common_interests: string[];

    @Column({ nullable: true })
    reason: string;

    @Column({ default: 'pending' })
    status: string;

    @CreateDateColumn()
    created_at: Date;
}