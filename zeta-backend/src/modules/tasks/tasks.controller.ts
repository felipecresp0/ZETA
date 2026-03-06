import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Get('me')
    findMyTasks(@CurrentUser('id') userId: string) {
        return this.tasksService.findMyTasks(userId);
    }

    @Post()
    create(@Body() dto: CreateTaskDto, @CurrentUser('id') userId: string) {
        return this.tasksService.create(dto, userId);
    }

    @Patch(':id')
    update(
        @Param('id') taskId: string,
        @Body() dto: UpdateTaskDto,
        @CurrentUser('id') userId: string,
    ) {
        return this.tasksService.update(taskId, dto, userId);
    }

    @Delete(':id')
    remove(@Param('id') taskId: string, @CurrentUser('id') userId: string) {
        return this.tasksService.remove(taskId, userId);
    }
}
