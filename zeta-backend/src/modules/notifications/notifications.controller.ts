import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    getMyNotifications(@CurrentUser('id') userId: string) {
        return this.notificationsService.getMyNotifications(userId);
    }

    @Get('unread-count')
    getUnreadCount(@CurrentUser('id') userId: string) {
        return this.notificationsService.getUnreadCount(userId);
    }

    @Post('read-all')
    markAllAsRead(@CurrentUser('id') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    @Post(':id/read')
    markAsRead(@Param('id') notifId: string, @CurrentUser('id') userId: string) {
        return this.notificationsService.markAsRead(notifId, userId);
    }
}
