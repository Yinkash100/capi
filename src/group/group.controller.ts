import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Logger,
    NotFoundException,
    ForbiddenException,
    Delete,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateGroupDto } from './dto/create-group.dto';
  import { GroupResponseDto } from './dto/group-response.dto';
  import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
  
  @ApiTags('groups')
  @Controller('groups')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.USER)
  @ApiBearerAuth()
  export class GroupController {
    private readonly logger = new Logger(GroupController.name);
  
    constructor(private readonly prisma: PrismaService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new group' })
    @ApiResponse({ status: 201, description: 'Group created successfully', type: GroupResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createGroup(@Body() createGroupDto: CreateGroupDto, @GetCurrentUser() user: any): Promise<GroupResponseDto> {
      try {
        this.logger.log(`Creating group for user ${user.id}: ${JSON.stringify(createGroupDto)}`);
  
        // Create group and make the creator an admin
        const group = await this.prisma.group.create({
          data: {
            name: createGroupDto.name,
            description: createGroupDto.description,
            members: {
              create: {
                userId: user.id,
                isAdmin: true,
              },
            },
          },
        });
  
        return new GroupResponseDto(group);
      } catch (error) {
        this.logger.error(`Error creating group: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all groups' })
    @ApiResponse({ status: 200, description: 'List of all groups', type: [GroupResponseDto] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getAllGroups(): Promise<GroupResponseDto[]> {
      try {
        this.logger.log('Fetching all groups');
  
        const groups = await this.prisma.group.findMany({
          orderBy: { createdAt: 'desc' },
        });
  
        return groups.map(group => new GroupResponseDto(group));
      } catch (error) {
        this.logger.error(`Error fetching groups: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get('my-groups')
    @ApiOperation({ summary: 'Get groups the user is a member of' })
    @ApiResponse({ status: 200, description: 'List of user\'s groups', type: [GroupResponseDto] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getMyGroups(@GetCurrentUser() user: any): Promise<GroupResponseDto[]> {
      try {
        this.logger.log(`Fetching groups for user ${user.id}`);
  
        const groupMembers = await this.prisma.groupMember.findMany({
          where: { userId: user.id },
          include: { group: true },
        });
  
        return groupMembers.map(member => new GroupResponseDto(member.group));
      } catch (error) {
        this.logger.error(`Error fetching user groups: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get group by ID' })
    @ApiResponse({ status: 200, description: 'Group details', type: GroupResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    async getGroupById(@Param('id') id: string): Promise<GroupResponseDto> {
      try {
        this.logger.log(`Fetching group with ID: ${id}`);
  
        const group = await this.prisma.group.findUnique({
          where: { id },
        });
  
        if (!group) {
          this.logger.warn(`Group not found: ${id}`);
          throw new NotFoundException(`Group with ID ${id} not found`);
        }
  
        return new GroupResponseDto(group);
      } catch (error) {
        this.logger.error(`Error fetching group: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get(':id/members')
    @ApiOperation({ summary: 'Get group members' })
    @ApiResponse({ status: 200, description: 'List of group members' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    async getGroupMembers(@Param('id') id: string): Promise<any[]> {
      try {
        this.logger.log(`Fetching members for group: ${id}`);
  
        const group = await this.prisma.group.findUnique({
          where: { id },
        });
  
        if (!group) {
          this.logger.warn(`Group not found: ${id}`);
          throw new NotFoundException(`Group with ID ${id} not found`);
        }
  
        const members = await this.prisma.groupMember.findMany({
          where: { groupId: id },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
  
        return members.map(member => ({
          id: member.id,
          userId: member.userId,
          isAdmin: member.isAdmin,
          joinedAt: member.joinedAt,
          user: {
            id: member.user.id,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            email: member.user.email,
          },
        }));
      } catch (error) {
        this.logger.error(`Error fetching group members: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get(':id/messages')
    @ApiOperation({ summary: 'Get group messages' })
    @ApiResponse({ status: 200, description: 'List of group messages' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a group member' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    async getGroupMessages(@Param('id') id: string, @GetCurrentUser() user: any): Promise<any[]> {
      try {
        this.logger.log(`Fetching messages for group: ${id}`);
  
        // Check if group exists
        const group = await this.prisma.group.findUnique({
          where: { id },
        });
  
        if (!group) {
          this.logger.warn(`Group not found: ${id}`);
          throw new NotFoundException(`Group with ID ${id} not found`);
        }
  
        // Check if user is a member of the group
        const isMember = await this.prisma.groupMember.findUnique({
          where: {
            userId_groupId: {
              userId: user.id,
              groupId: id,
            },
          },
        });
  
        if (!isMember) {
          this.logger.warn(`User ${user.id} is not a member of group ${id}`);
          throw new ForbiddenException('You are not a member of this group');
        }
  
        // Get group messages
        const messages = await this.prisma.groupMessage.findMany({
          where: { groupId: id },
          orderBy: { createdAt: 'asc' },
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
  
        return messages.map(message => ({
          id: message.id,
          content: message.content,
          userId: message.userId,
          groupId: message.groupId,
          createdAt: message.createdAt,
          user: {
            id: message.user.id,
            firstName: message.user.firstName,
            lastName: message.user.lastName,
          },
        }));
      } catch (error) {
        this.logger.error(`Error fetching group messages: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a group' })
    @ApiResponse({ status: 200, description: 'Group deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a group admin' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    async deleteGroup(@Param('id') id: string, @GetCurrentUser() user: any): Promise<{ message: string }> {
      try {
        this.logger.log(`Deleting group with ID: ${id}`);
  
        // Check if group exists
        const group = await this.prisma.group.findUnique({
          where: { id },
        });
  
        if (!group) {
          this.logger.warn(`Group not found: ${id}`);
          throw new NotFoundException(`Group with ID ${id} not found`);
        }
  
        // Check if user is an admin of the group
        const userMembership = await this.prisma.groupMember.findUnique({
          where: {
            userId_groupId: {
              userId: user.id,
              groupId: id,
            },
          },
        });
  
        if (!userMembership || !userMembership.isAdmin) {
          this.logger.warn(`User ${user.id} attempted to delete group ${id} without admin privileges`);
          throw new ForbiddenException('Only group admins can delete groups');
        }
  
        // Delete group
        await this.prisma.group.delete({
          where: { id },
        });
  
        return { message: 'Group deleted successfully' };
      } catch (error) {
        this.logger.error(`Error deleting group: ${error.message}`, error.stack);
        throw error;
      }
    }
  }