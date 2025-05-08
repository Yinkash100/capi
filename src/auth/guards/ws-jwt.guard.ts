import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const user = client.handshake.auth.user;

      // If user object is already set in auth (from handleConnection), use it
      if (user && user.id) {
        return true;
      }

      // Otherwise, try to get the token and verify it
      const token = this.extractTokenFromHeader(client);
      if (!token) {
        throw new WsException('Unauthorized access');
      }

      try {
        const payload = await this.jwtService.verifyAsync(token);
        // Save user info to the socket object for later use
        client.handshake.auth.user = payload;
        return true;
      } catch {
        throw new WsException('Invalid token');
      }
    } catch (err) {
      throw new WsException('Unauthorized access');
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!auth) return undefined;

    // Handle both "Bearer TOKEN" format and raw token
    const parts = auth.toString().split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return auth.toString();
  }
}