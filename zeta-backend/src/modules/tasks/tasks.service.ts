import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,
        private readonly notificationsService: NotificationsService,
    ) { }

    async create(dto: CreateTaskDto, userId: string) {
        const task = this.taskRepo.create({
            ...dto,
            user_id: userId,
        });
        const saved = await this.taskRepo.save(task);

        // Disparar workflow de priorización IA en n8n (envía datos completos)
        const n8nUrl = process.env.N8N_WEBHOOK_TASK_PRIORITY || 'http://localhost:5678/webhook/task-priority';
        axios.post(n8nUrl, {
            task_id: saved.id,
            user_id: userId,
            title: saved.title,
            description: saved.description,
            subject: saved.subject,
            due_date: saved.due_date,
        }).catch(err => console.error('[Tasks] Error al disparar n8n:', err.message));

        // Crear notificación de tarea creada
        const dueFormatted = new Date(saved.due_date).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        this.notificationsService.create({
            userId,
            type: 'task_created',
            title: 'Nueva tarea creada',
            body: `${saved.title}${saved.subject ? ' · ' + saved.subject : ''} — Entrega: ${dueFormatted}`,
            data: { taskId: saved.id },
        }).catch(err => console.error('[Tasks] Error creando notificación:', err.message));

        return this.findOneOrFail(saved.id, userId);
    }

    async findMyTasks(userId: string) {
        return this.taskRepo.find({
            where: { user_id: userId },
            relations: ['group'],
            order: { created_at: 'DESC' },
        });
    }

    async update(taskId: string, dto: UpdateTaskDto, userId: string) {
        const task = await this.findOneOrFail(taskId, userId);
        Object.assign(task, dto);
        await this.taskRepo.save(task);
        return this.findOneOrFail(taskId, userId);
    }

    async remove(taskId: string, userId: string) {
        const task = await this.findOneOrFail(taskId, userId);
        await this.taskRepo.remove(task);
        return { message: 'Task deleted' };
    }

    // Llamado por n8n cuando termina de analizar la tarea
    async updateAIPriority(taskId: string, data: { priority: string; estimated_hours: number }) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');

        task.priority = data.priority;
        task.estimated_hours = data.estimated_hours;
        task.ai_pioritized = true;
        await this.taskRepo.save(task);
        return task;
    }

    private async findOneOrFail(taskId: string, userId: string) {
        const task = await this.taskRepo.findOne({
            where: { id: taskId },
            relations: ['group'],
        });

        if (!task) throw new NotFoundException('Task not found');
        if (task.user_id !== userId) throw new ForbiddenException('Not your task');

        return task;
    }
}