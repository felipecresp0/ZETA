import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';

@Entity('tasks')
export class Task {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;             // "Informe BD"

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    subject: string;           // "Base de Datos"

    @Column({ type: 'timestamp', nullable: true })
    due_date: Date;

    @Column({ type: 'float', nullable: true })
    estimated_hours: number;   // Estimado por IA

    @Column({ default: 'medium' })
    priority: string;          // low | medium | high | urgent — asignado por IA

    @Column({ default: 'pending' })
    status: string;            // pending | in_progress | completed

    // ── Creador (siempre obligatorio) ──
    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: string;

    // ── Grupo (opcional — null = tarea personal) ──
    @ManyToOne(() => Group, { nullable: true })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @Column({ nullable: true })
    group_id: string;

    @CreateDateColumn()
    created_at: Date;
}