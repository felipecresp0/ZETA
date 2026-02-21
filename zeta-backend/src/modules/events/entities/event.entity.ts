import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

@Entity('events')
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;              // "Café networking"

    @Column({ nullable: true })
    description: string;

    @Column({ type: 'timestamp' })
    event_date: Date;

    @Column({ nullable: true })
    location: string;          // "Cafetería Campus"

    @ManyToOne(() => Group, (g) => g.events, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @Column()
    group_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'creator_id' })
    creator: User;

    @Column()
    creator_id: string;

    @CreateDateColumn()
    created_at: Date;
}