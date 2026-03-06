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
import axios from 'axios';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly taskRepo: Repository<Task>,
    ) { }

    async create(dto: CreateTaskDto, userId: string) {
        const task = this.taskRepo.create({
            ...dto,
            user_id: userId,
        });
        const saved = await this.taskRepo.save(task);

        // Disparar workflow de priorización IA en n8n
        const n8nUrl = process.env.N8N_WEBHOOK_TASK_PRIORITY || 'http://localhost:5678/webhook/task-priority';
        axios.post(n8nUrl, { task_id: saved.id, user_id: userId })
            .catch(err => console.error('[Tasks] Error al disparar n8n:', err.message));

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