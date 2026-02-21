import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('interests')
export class Interest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;              // "Fútbol", "Gaming", "Lectura"

    @Column()
    category: string;          // "Deportes", "Ocio", "Cultura"

    @Column({ nullable: true })
    icon: string;              // emoji o nombre de icono
}