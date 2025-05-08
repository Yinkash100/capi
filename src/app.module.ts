import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { LoggingModule } from './logging/logging.module';
import { EmailModule } from './email/email.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.service';
import { MessagesModule } from './messages/messages.module';
import { GroupModule } from './group/group.module';
import { WebSocketModule } from './websocket/webSocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get('THROTTLE_TTL', 60),
          limit: configService.get('THROTTLE_LIMIT', 10),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    AdminModule,
    LoggingModule,
    EmailModule,
    MessagesModule,
    GroupModule,
    WebSocketModule
  ],
  controllers: [AppController, MessagesController],
  providers: [AppService, MessagesService],
})
export class AppModule {}
