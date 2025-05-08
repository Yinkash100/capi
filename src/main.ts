import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { JwtService } from '@nestjs/jwt';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { MessagesModule } from './messages/messages.module';
import { GroupModule } from './group/group.module';
import { AuthModule } from './auth/auth.module';


class WebSocketAdapter extends IoAdapter {
  private readonly jwtService: JwtService;

  constructor(app: INestApplication<any>) {
    super(app);
    this.jwtService = app.get(JwtService);
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    
    // Add authentication middleware for WebSocket connections
    server.use(async (socket, next) => {
      try {
        const token = this.extractTokenFromHeader(socket);
        
        if (!token) {
          return next(new Error('Authentication error'));
        }
        
        try {
          const payload = await this.jwtService.verifyAsync(token);
          // Add user data to socket handshake for later use
          socket.handshake.auth.user = payload;
          next();
        } catch (error) {
          next(new Error('Invalid token'));
        }
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
    
    return server;
  }
  
  private extractTokenFromHeader(socket): string | undefined {
    const auth = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!auth) return undefined;
    
    const parts = auth.toString().split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return auth.toString();
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useWebSocketAdapter(new WebSocketAdapter(app));
  
  app.setGlobalPrefix('api');


  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  const userConfig = new DocumentBuilder()
    .setTitle('NestJS API - User')
    .setDescription('User API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const userDocument = SwaggerModule.createDocument(app, userConfig, {
    include: [
      AuthModule,
      UserModule,
      MessagesModule,
      GroupModule

    ],
  });
  
  SwaggerModule.setup('api/docs/user', app, userDocument);
  
  const adminConfig = new DocumentBuilder()
    .setTitle('NestJS API - Admin')
    .setDescription('Admin API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const adminDocument = SwaggerModule.createDocument(app, adminConfig, {
    include: [
      // Include modules for admin documentation|
      AuthModule,
      AdminModule,
    ],
  });
  
  SwaggerModule.setup('api/docs/admin', app, adminDocument);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
