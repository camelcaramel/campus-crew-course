import { Module } from '@nestjs/common';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecruitmentsModule } from './modules/recruitments/recruitments.module';

@Module({
  imports: [RecruitmentsModule, AuthModule, ApplicationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
