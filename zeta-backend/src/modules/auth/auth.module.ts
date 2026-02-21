import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

import { User } from '../users/entities/user.entity';
import { University } from '../universities/entities/university.entity';
import { Interest } from '../interests/entities/interest.entity';
import { AcademicOffer } from '../universities/entities/academic-offer.entity';

@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                secret: cfg.get('JWT_SECRET'),
                signOptions: { expiresIn: cfg.get('JWT_EXPIRATION', '7d') },
            }),
        }),
        // Entidades que Auth necesita consultar directamente
        TypeOrmModule.forFeature([User, University, Interest, AcademicOffer]),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, LocalStrategy],
    exports: [AuthService],
})
export class AuthModule { }