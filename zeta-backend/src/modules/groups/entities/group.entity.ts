import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, OneToMany, JoinColumn, CreateDateColumn
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Event } from '../../events/entities/event.entity';
import { GroupMember } from './group-member.entity';

@Entity('groups')
export class Group {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;              // "Ingeniería 1º Zaragoza"

    @Column({ nullable: true })
    description: string;

    @Column({ default: 'general' })
    type: string;              // general | carrera | interes | estudio

    @Column({ default: 'public' })
    privacy: string;           // public | university | private

    @ManyToOne(() => User)
    @JoinColumn({ name: 'creator_id' })
    creator: User;

    @Column()
    creator_id: string;

    @OneToMany(() => GroupMember, (gm) => gm.group)
    members: GroupMember[];

    @OneToMany(() => Event, (event) => event.group)
    events: Event[];

    @CreateDateColumn()
    created_at: Date;
}