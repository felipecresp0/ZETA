import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) { }

    // POST /api/groups — Crear grupo
    @Post()
    create(@Body() dto: CreateGroupDto, @CurrentUser('id') userId: string) {
        return this.groupsService.create(dto, userId);
    }

    // GET /api/groups/me — Mis grupos
    @Get('me')
    findMyGroups(@CurrentUser('id') userId: string) {
        return this.groupsService.findMyGroups(userId);
    }

    // GET /api/groups/explore — Grupos públicos para explorar
    @Get('explore')
    findPublicGroups(@CurrentUser('id') userId: string) {
        return this.groupsService.findPublicGroups(userId);
    }

    // GET /api/groups/:id — Detalle de un grupo
    @Get(':id')
    findOne(@Param('id') groupId: string) {
        return this.groupsService.findOne(groupId);
    }

    // PATCH /api/groups/:id — Actualizar grupo
    @Patch(':id')
    update(
        @Param('id') groupId: string,
        @Body() dto: UpdateGroupDto,
        @CurrentUser('id') userId: string,
    ) {
        return this.groupsService.update(groupId, dto, userId);
    }

    // POST /api/groups/:id/join — Unirse a un grupo
    @Post(':id/join')
    join(@Param('id') groupId: string, @CurrentUser('id') userId: string) {
        return this.groupsService.join(groupId, userId);
    }

    // POST /api/groups/:id/leave — Salir de un grupo
    @Post(':id/leave')
    leave(@Param('id') groupId: string, @CurrentUser('id') userId: string) {
        return this.groupsService.leave(groupId, userId);
    }

    // DELETE /api/groups/:id — Eliminar grupo
    @Delete(':id')
    remove(@Param('id') groupId: string, @CurrentUser('id') userId: string) {
        return this.groupsService.remove(groupId, userId);
    }
}