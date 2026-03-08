import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, UseGuards, Headers, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AiCallbackDto } from './dto/ai-callback.dto';

@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    // ── Endpoint interno para n8n (sin JWT, protegido por API key) ──
    @Patch('ai-callback')
    aiCallback(
        @Body() dto: AiCallbackDto,
        @Headers('x-internal-key') internalKey: string,
    ) {
        const expected = process.env.N8N_INTERNAL_KEY || 'n8n-secret';
        if (internalKey !== expected) throw new ForbiddenException('Invalid internal key');
        return this.tasksService.updateAIPriority(dto.task_id, dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    findMyTasks(@CurrentUser('id') userId: string) {
        return this.tasksService.findMyTasks(userId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Body() dto: CreateTaskDto, @CurrentUser('id') userId: string) {
        return this.tasksService.create(dto, userId);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id') taskId: string,
        @Body() dto: UpdateTaskDto,
        @CurrentUser('id') userId: string,
    ) {
        return this.tasksService.update(taskId, dto, userId);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    remove(@Param('id') taskId: string, @CurrentUser('id') userId: string) {
        return this.tasksService.remove(taskId, userId);
    }
}
