import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('connections')
@Unique(['sender_id', 'receiver_id'])
export class Connection {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @Column()
    sender_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receiver_id' })
    receiver: User;

    @Column()
    receiver_id: string;

    @Column({ default: 'pending' })
    status: string; // pending | accepted | rejected

    @CreateDateColumn()
    created_at: Date;
}
