import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { MessageResponseDto } from '../messages/dto/message-response.dto';
import { CreateGroupMessageDto } from '../group/dto/create-group-message.dto';
import { GroupMessageResponseDto } from '../group/dto/group-message-response.dto';
import { JoinGroupDto } from '../group/dto/join-group.dto';
import { LeaveGroupDto } from '../group/dto/leave-group.dto';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);
  private userSocketMap = new Map<string, string>();
  private socketUserMap = new Map<string, string>();

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      // This assumes the token is properly validated with a WS auth guard middleware
      const user = client.handshake.auth.user;
      
      if (!user || !user.id) {
        this.logger.warn(`Client without valid auth tried to connect: ${client.id}`);
        client.disconnect();
        return;
      }

      this.userSocketMap.set(user.id, client.id);
      this.socketUserMap.set(client.id, user.id);
      
      // Join user to their personal room
      await client.join(`user_${user.id}`);
      
      // Join user to all their group rooms
      const userGroups = await this.prisma.groupMember.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });
      
      for (const { groupId } of userGroups) {
        await client.join(`group_${groupId}`);
      }
      
      this.logger.log(`Client connected: ${client.id} for user: ${user.id}`);
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = this.socketUserMap.get(client.id);
      if (userId) {
        this.userSocketMap.delete(userId);
        this.socketUserMap.delete(client.id);
        this.logger.log(`Client disconnected: ${client.id} for user: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`, error.stack);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createMessageDto: CreateMessageDto,
  ) {
    try {
      const userId = this.socketUserMap.get(client.id);
      
      if (!userId) {
        this.logger.warn(`Unauthorized message attempt from socket: ${client.id}`);
        return { event: 'error', data: 'Unauthorized' };
      }

      // Verify recipient exists
      const receiver = await this.prisma.user.findUnique({
        where: { id: createMessageDto.receiverId },
      });

      if (!receiver) {
        return { event: 'error', data: 'Recipient not found' };
      }

      // Create message in database
      const message = await this.prisma.message.create({
        data: {
          content: createMessageDto.content,
          senderId: userId,
          receiverId: createMessageDto.receiverId,
        },
      });

      const messageResponse = new MessageResponseDto(message);

      // Emit to sender and receiver
      this.server.to(`user_${userId}`).emit('messageReceived', messageResponse);
      this.server.to(`user_${createMessageDto.receiverId}`).emit('messageReceived', messageResponse);

      this.logger.log(`Message sent from ${userId} to ${createMessageDto.receiverId}`);
      
      return { event: 'messageSent', data: messageResponse };
    } catch (error) {
      this.logger.error(`Error in handleSendMessage: ${error.message}`, error.stack);
      return { event: 'error', data: 'Failed to send message' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markMessageAsRead')
  async handleMarkMessageAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId }: { messageId: string },
  ) {
    try {
      const userId = this.socketUserMap.get(client.id);
      
      if (!userId) {
        return { event: 'error', data: 'Unauthorized' };
      }

      // Find message and verify it belongs to this user
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          receiverId: userId,
        },
      });

      if (!message) {
        return { event: 'error', data: 'Message not found' };
      }

      // Update message to mark as read
      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: { read: true },
      });

      const messageResponse = new MessageResponseDto(updatedMessage);

      // Notify both users
      this.server.to(`user_${userId}`).emit('messageUpdated', messageResponse);
      this.server.to(`user_${message.senderId}`).emit('messageUpdated', messageResponse);

      return { event: 'messageMarkedAsRead', data: messageResponse };
    } catch (error) {
      this.logger.error(`Error in handleMarkMessageAsRead: ${error.message}`, error.stack);
      return { event: 'error', data: 'Failed to mark message as read' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() joinGroupDto: JoinGroupDto,
  ) {
    try {
      const userId = this.socketUserMap.get(client.id);
      
      if (!userId) {
        return { event: 'error', data: 'Unauthorized' };
      }

      // Check if group exists
      const group = await this.prisma.group.findUnique({
        where: { id: joinGroupDto.groupId },
      });

      if (!group) {
        return { event: 'error', data: 'Group not found' };
      }

      // Check if user is already a member
      const existingMember = await this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: userId,
            groupId: joinGroupDto.groupId,
          },
        },
      });

      if (existingMember) {
        return { event: 'error', data: 'You are already a member of this group' };
      }

      // Add user to group
      const groupMember = await this.prisma.groupMember.create({
        data: {
          userId: userId,
          groupId: joinGroupDto.groupId,
        },
      });

      // Join socket to group room
      await client.join(`group_${joinGroupDto.groupId}`);

      // Notify group of new member
      this.server.to(`group_${joinGroupDto.groupId}`).emit('userJoinedGroup', {
        userId,
        groupId: joinGroupDto.groupId,
        joinedAt: groupMember.joinedAt,
      });

      this.logger.log(`User ${userId} joined group ${joinGroupDto.groupId}`);
      
      return { event: 'groupJoined', data: { groupId: joinGroupDto.groupId } };
    } catch (error) {
      this.logger.error(`Error in handleJoinGroup: ${error.message}`, error.stack);
      return { event: 'error', data: 'Failed to join group' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveGroup')
  async handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() leaveGroupDto: LeaveGroupDto,
  ) {
    try {
      const userId = this.socketUserMap.get(client.id);
      
      if (!userId) {
        return { event: 'error', data: 'Unauthorized' };
      }

      // Check if user is a member
      const groupMember = await this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: userId,
            groupId: leaveGroupDto.groupId,
          },
        },
      });

      if (!groupMember) {
        return { event: 'error', data: 'You are not a member of this group' };
      }

      // Remove user from group
      await this.prisma.groupMember.delete({
        where: {
          userId_groupId: {
            userId: userId,
            groupId: leaveGroupDto.groupId,
          },
        },
      });

      // Leave socket room
      await client.leave(`group_${leaveGroupDto.groupId}`);

      // Notify group members that user left
      this.server.to(`group_${leaveGroupDto.groupId}`).emit('userLeftGroup', {
        userId,
        groupId: leaveGroupDto.groupId,
      });

      this.logger.log(`User ${userId} left group ${leaveGroupDto.groupId}`);
      
      return { event: 'groupLeft', data: { groupId: leaveGroupDto.groupId } };
    } catch (error) {
      this.logger.error(`Error in handleLeaveGroup: ${error.message}`, error.stack);
      return { event: 'error', data: 'Failed to leave group' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendGroupMessage')
  async handleSendGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createGroupMessageDto: CreateGroupMessageDto,
  ) {
    try {
      const userId = this.socketUserMap.get(client.id);
      
      if (!userId) {
        return { event: 'error', data: 'Unauthorized' };
      }

      // Check if user is a member of the group
      const groupMember = await this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: userId,
            groupId: createGroupMessageDto.groupId,
          },
        },
      });

      if (!groupMember) {
        return { event: 'error', data: 'You are not a member of this group' };
      }

      // Create group message
      const groupMessage = await this.prisma.groupMessage.create({
        data: {
          content: createGroupMessageDto.content,
          userId: userId,
          groupId: createGroupMessageDto.groupId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const groupMessageResponse = new GroupMessageResponseDto(groupMessage);

      // Add the user info to the response
      const responseWithUserInfo = {
        ...groupMessageResponse,
        user: {
          id: groupMessage.user.id,
          firstName: groupMessage.user.firstName,
          lastName: groupMessage.user.lastName,
        },
      };

      // Emit to all members in the group
      this.server.to(`group_${createGroupMessageDto.groupId}`).emit('groupMessageReceived', responseWithUserInfo);

      this.logger.log(`Group message sent by ${userId} to group ${createGroupMessageDto.groupId}`);
      
      return { event: 'groupMessageSent', data: responseWithUserInfo };
    } catch (error) {
      this.logger.error(`Error in handleSendGroupMessage: ${error.message}`, error.stack);
      return { event: 'error', data: 'Failed to send group message' };
    }
  }
}