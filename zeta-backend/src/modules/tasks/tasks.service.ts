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
