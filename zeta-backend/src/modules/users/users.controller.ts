import {
    Controller, Get, Patch, Param, Body, UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // GET /api/users/me — Perfil propio
    @Get('me')
    async getMyProfile(@CurrentUser('id') userId: string) {
        return this.usersService.getMyProfile(userId);
    }

    // PATCH /api/users/me — Actualizar perfil (onboarding + edición)
    @Patch('me')
    async updateProfile(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.usersService.updateProfile(userId, dto);
    }

    // GET /api/users/:id — Ver perfil de otro usuario
    @Get(':id')
    async getUserProfile(
        @Param('id') targetId: string,
        @CurrentUser('id') requesterId: string,
    ) {
        return this.usersService.getUserProfile(targetId, requesterId);
    }
}