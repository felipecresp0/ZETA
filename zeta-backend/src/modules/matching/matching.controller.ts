import {
    Controller, Get, Patch,
    Param, UseGuards, Body, Post
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchingService } from './matching.service';


@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchingController {
    constructor(private readonly matchingService: MatchingService) { }

    @Get('me')
    findMyMatches(@CurrentUser('id') userId: string) {
        return this.matchingService.findMyMatches(userId);
    }

    @Patch(':id/accept')
    accept(@Param('id') matchId: string, @CurrentUser('id') userId: string) {
        return this.matchingService.accept(matchId, userId);
    }

    @Patch(':id/reject')
    reject(@Param('id') matchId: string, @CurrentUser('id') userId: string) {
        return this.matchingService.reject(matchId, userId);
    }
    @Get('connections')
    findMyConnections(@CurrentUser('id') userId: string) {
    return this.matchingService.findMyConnections(userId);
    }
    @Post('notify')
    async notifyMatches(@Body() body: { user_ids: string[]; match_count: number }) {
        return this.matchingService.notifyMatches(body.user_ids, body.match_count);
    }
}
