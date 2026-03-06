import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get('users')
    searchUsers(
        @Query('q') query: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.searchService.searchUsers(query, userId);
    }

    @Get('groups')
    searchGroups(
        @Query('q') query: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.searchService.searchGroups(query, userId);
    }

    @Get('events')
    searchEvents(@Query('q') query: string) {
        return this.searchService.searchEvents(query);
    }
}
