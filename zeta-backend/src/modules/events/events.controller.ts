import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, UseGuards
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    // POST /api/events — Crear evento
    @Post()
    create(@Body() dto: CreateEventDto, @CurrentUser('id') userId: string) {
        return this.eventsService.create(dto, userId);
    }

    // GET /api/events/upcoming — Mis próximos eventos
    @Get('upcoming')
    findMyUpcoming(@CurrentUser('id') userId: string) {
        return this.eventsService.findMyUpcoming(userId);
    }

    // GET /api/events/group/:groupId — Eventos de un grupo
    @Get('group/:groupId')
    findByGroup(@Param('groupId') groupId: string) {
        return this.eventsService.findByGroup(groupId);
    }

    // GET /api/events/:id — Detalle de evento
    @Get(':id')
    findOne(@Param('id') eventId: string) {
        return this.eventsService.findOne(eventId);
    }

    // PATCH /api/events/:id — Actualizar evento
    @Patch(':id')
    update(
        @Param('id') eventId: string,
        @Body() dto: UpdateEventDto,
        @CurrentUser('id') userId: string,
    ) {
        return this.eventsService.update(eventId, dto, userId);
    }

    // DELETE /api/events/:id — Eliminar evento
    @Delete(':id')
    remove(@Param('id') eventId: string, @CurrentUser('id') userId: string) {
        return this.eventsService.remove(eventId, userId);
    }
}