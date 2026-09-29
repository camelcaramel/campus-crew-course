import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationSessionGuard } from './application-session.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationSessionGuard],
})
export class ApplicationsModule {}
