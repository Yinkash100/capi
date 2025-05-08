import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { LoggingService } from '../logging/logging.service';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggingService,
    private readonly emailService: EmailService,
  ) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async createAdmin(createAdminDto: CreateAdminDto, currentAdminId: string) {
    // Check if email already exists
    const emailExists = await this.prisma.user.findUnique({
      where: { email: createAdminDto.email },
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    // Generate a temporary password
    const temporaryPassword = uuidv4().substring(0, 8);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create the admin user
    const newAdmin = await this.prisma.user.create({
      data: {
        email: createAdminDto.email,
        password: hashedPassword,
        firstName: createAdminDto.firstName,
        lastName: createAdminDto.lastName,
        country: createAdminDto.country,
        role: Role.ADMIN,
        isVerified: true, // Admins are auto-verified
      },
    });

    this.logger.info(
      'AdminService',
      `Admin created by admin ID ${currentAdminId}: ${newAdmin.email}`,
    );

    // Send email with temporary password
    await this.emailService.sendMail({
      to: newAdmin.email,
      subject: 'Admin Account Created',
      html: `
        <h3>Welcome to Chat API Admin!</h3>
        <p>Your admin account has been created. Here are your login details:</p>
        <p><strong>Email:</strong> ${newAdmin.email}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        <p>Please login and change your password immediately.</p>
      `,
    });

    const { password, ...result } = newAdmin;
    return result;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.info('AdminService', `User updated by admin: ${updatedUser.email}`);

    return updatedUser;
  }

  async setUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.info(
      'AdminService',
      `User role changed: ${updatedUser.email} is now ${role}`,
    );

    return updatedUser;
  }
  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.prisma.user.delete({ where: { id } });

    this.logger.info('AdminService', `User deleted: ID ${id}`);

    return { message: `User with ID ${id} has been deleted` };
  }

  async getSystemStats() {
    const totalUsers = await this.prisma.user.count();
    const adminUsers = await this.prisma.user.count({
      where: { role: Role.ADMIN },
    });
    const regularUsers = await this.prisma.user.count({
      where: { role: Role.USER },
    });
    const verifiedUsers = await this.prisma.user.count({
      where: { isVerified: true },
    });
    const unverifiedUsers = await this.prisma.user.count({
      where: { isVerified: false },
    });
    const totalMessages = await this.prisma.message.count();
    const totalGroups = await this.prisma.group.count();
    const totalGroupMessages = await this.prisma.groupMessage.count();

    return {
      users: {
        total: totalUsers,
        admins: adminUsers,
        regular: regularUsers,
        verified: verifiedUsers,
        unverified: unverifiedUsers,
      },
      messages: {
        direct: totalMessages,
        group: totalGroupMessages,
        total: totalMessages + totalGroupMessages,
      },
      groups: totalGroups,
    };
  }
}