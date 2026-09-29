import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { authJwtOptions } from './auth-config';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({ useFactory: authJwtOptions }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
