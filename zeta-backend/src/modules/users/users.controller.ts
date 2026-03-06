import {
    Controller, Get, Post, Patch, Param, Body, UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // GET /api/users/me
    @Get('me')
    async getMyProfile(@CurrentUser('id') userId: string) {
        return this.usersService.getMyProfile(userId);
    }

    // PATCH /api/users/me
    @Patch('me')
    async updateProfile(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.usersService.updateProfile(userId, dto);
    }

    @Patch('me/push-token')
    async updatePushToken(
        @CurrentUser('id') userId: string,
        @Body('push_token') pushToken: string,
    ) {
        return this.usersService.updatePushToken(userId, pushToken);
    }

    // GET /api/users/connections/pending — Solicitudes pendientes
    @Get('connections/pending')
    getPendingConnections(@CurrentUser('id') userId: string) {
        return this.usersService.getPendingConnections(userId);
    }

    // GET /api/users/connections/status/:targetId
    @Get('connections/status/:targetId')
    getConnectionStatus(
        @Param('targetId') targetId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.usersService.getConnectionStatus(userId, targetId);
    }

    // POST /api/users/connect/:targetId — Enviar solicitud
    @Post('connect/:targetId')
    sendConnection(
        @Param('targetId') targetId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.usersService.sendConnection(userId, targetId);
    }

    // POST /api/users/connect/:connectionId/accept
    @Post('connect/:connectionId/accept')
    acceptConnection(
        @Param('connectionId') connectionId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.usersService.respondConnection(connectionId, userId, 'accepted');
    }

    // POST /api/users/connect/:connectionId/reject
    @Post('connect/:connectionId/reject')
    rejectConnection(
        @Param('connectionId') connectionId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.usersService.respondConnection(connectionId, userId, 'rejected');
    }

    // GET /api/users/:id — Ver perfil (MUST be last due to :id wildcard)
    @Get(':id')
    async getUserProfile(
        @Param('id') targetId: string,
        @CurrentUser('id') requesterId: string,
    ) {
        return this.usersService.getUserProfile(targetId, requesterId);
    }
}
