import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    user_id: string;

    // connection_request | connection_accepted | match | event_rsvp | group_joined
    @Column()
    type: string;

    @Column({ nullable: true })
    title: string;

    @Column({ nullable: true })
    body: string;

    // JSON con datos extra: { groupId, eventId, matchId, senderId, ... }
    @Column({ type: 'jsonb', nullable: true })
    data: Record<string, any>;

    @Column({ default: false })
    read: boolean;

    @CreateDateColumn()
    created_at: Date;

    @ManyToOne(() => User, { eager: false })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
