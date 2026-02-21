import {
    Entity, PrimaryGeneratedColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';

@Entity('conversations')
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ default: 'direct' })
    type: string;              // direct | group

    // Si es chat de grupo, referencia al grupo. Si es 1:1, null.
    @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @Column({ nullable: true })
    group_id: string;

    // Participantes como array nativo de PostgreSQL
    @Column('text', { array: true, nullable: true })
    participant_ids: string[];

    @Column({ nullable: true })
    last_message_preview: string;  // "Carlos: Yo los tengo, ahora los subo"

    @UpdateDateColumn()
    last_message_at: Date;     // Para ordenar lista de chats

    @CreateDateColumn()
    created_at: Date;
}