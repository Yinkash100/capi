import {
    Controller,
    Get,
    Param,
    UseGuards,
    Logger,
    NotFoundException,
    ForbiddenException,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { PrismaService } from '../prisma/prisma.service';
  import { MessageResponseDto } from './dto/message-response.dto';
  import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
  
  @ApiTags('messages')
  @Controller('messages')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.USER)
  @ApiBearerAuth()
  export class MessagesController {
    private readonly logger = new Logger(MessagesController.name);
  
    constructor(private readonly prisma: PrismaService) {}
  
    @Get('conversations')
    @ApiOperation({ summary: 'Get all user conversations' })
    @ApiResponse({ status: 200, description: 'List of conversations' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getConversations(@GetCurrentUser() user: any): Promise<any[]> {
      try {
        this.logger.log(`Fetching conversations for user: ${user.id}`);
  
        // Get all users the current user has exchanged messages with
        const sentMessages = await this.prisma.message.findMany({
          where: { senderId: user.id },
          select: { receiverId: true },
          distinct: ['receiverId'],
        });
  
        const receivedMessages = await this.prisma.message.findMany({
          where: { receiverId: user.id },
          select: { senderId: true },
          distinct: ['senderId'],
        });
  
        // Combine unique user IDs
        const conversationUserIds = new Set([
          ...sentMessages.map(m => m.receiverId),
          ...receivedMessages.map(m => m.senderId),
        ]);
  
        // Get user details and latest message for each conversation
        const conversations: any = [];
        for (const conversationUserId of conversationUserIds) {
          const conversationUser = await this.prisma.user.findUnique({
            where: { id: conversationUserId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          });
  
          // Get latest message
          const latestMessage = await this.prisma.message.findFirst({
            where: {
              OR: [
                { senderId: user.id, receiverId: conversationUserId },
                { senderId: conversationUserId, receiverId: user.id },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });
  
          // Count unread messages
          const unreadCount = await this.prisma.message.count({
            where: {
              senderId: conversationUserId,
              receiverId: user.id,
              read: false,
            },
          });
  
          conversations.push({
            user: conversationUser,
            latestMessage: latestMessage ? new MessageResponseDto(latestMessage) : null,
            unreadCount,
          });
        }
  
        return conversations;
      } catch (error) {
        this.logger.error(`Error fetching conversations: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get('conversation/:userId')
    @ApiOperation({ summary: 'Get conversation with a specific user' })
    @ApiResponse({ status: 200, description: 'List of messages' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getConversation(
      @Param('userId') userId: string,
      @GetCurrentUser() user: any,
    ): Promise<MessageResponseDto[]> {
      try {
        this.logger.log(`Fetching conversation between ${user.id} and ${userId}`);
  
        // Check if the other user exists
        const otherUser = await this.prisma.user.findUnique({
          where: { id: userId },
        });
  
        if (!otherUser) {
          this.logger.warn(`User not found: ${userId}`);
          throw new NotFoundException(`User with ID ${userId} not found`);
        }
  
        // Get messages between the users
        const messages = await this.prisma.message.findMany({
          where: {
            OR: [
              { senderId: user.id, receiverId: userId },
              { senderId: userId, receiverId: user.id },
            ],
          },
          orderBy: { createdAt: 'asc' },
        });
  
        // Mark all messages from the other user as read
        await this.prisma.message.updateMany({
          where: {
            senderId: userId,
            receiverId: user.id,
            read: false,
          },
          data: { read: true },
        });
  
        return messages.map(message => new MessageResponseDto(message));
      } catch (error) {
        this.logger.error(`Error fetching conversation: ${error.message}`, error.stack);
        throw error;
      }
    }
  }