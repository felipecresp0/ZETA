import {
    Controller, Get, Post, Param, Query, UseGuards
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ChatService } from '../chat/chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
    constructor(
        private readonly convService: ConversationsService,
        private readonly chatService: ChatService,
    ) { }

    // GET /api/conversations — Mis conversaciones
    @Get()
    findMyConversations(@CurrentUser('id') userId: string) {
        return this.convService.findMyConversations(userId);
    }

    // POST /api/conversations/direct/:targetUserId — Crear/obtener chat directo
    @Post('direct/:targetUserId')
    findOrCreateDirect(
        @Param('targetUserId') targetUserId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.convService.findOrCreateDirect(userId, targetUserId);
    }

    // GET /api/conversations/group/:groupId — Conversación de un grupo
    @Get('group/:groupId')
    findByGroup(
        @Param('groupId') groupId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.convService.findByGroup(groupId, userId);
    }

    // GET /api/conversations/:id — Detalle conversación
    @Get(':id')
    findOne(
        @Param('id') convId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.convService.findOne(convId, userId);
    }

    // GET /api/conversations/:id/messages — Mensajes paginados (vía REST)
    @Get(':id/messages')
    getMessages(
        @Param('id') convId: string,
        @CurrentUser('id') userId: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50',
    ) {
        return this.chatService.getMessages(convId, userId, parseInt(page), parseInt(limit));
    }

    // POST /api/conversations/:id/read — Marcar como leído
    @Post(':id/read')
    markAsRead(
        @Param('id') convId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.chatService.markAsRead(convId, userId);
    }
}