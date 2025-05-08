import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggingService } from 'src/logging/logging.service';

@Injectable()
export class UserService {
constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggingService,
) {}

async findAll() {
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

async findById(id: string) {
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

async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
    where: { email },
    });
}

async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    await this.findById(id);

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

    this.logger.info('UserService', `User updated: ${updatedUser.email}`);
    
    return updatedUser;
}

async remove(id: string) {
    // Check if user exists
    await this.findById(id);

    await this.prisma.user.delete({
    where: { id },
    });

    this.logger.info('UserService', `User deleted: ID ${id}`);
    
    return { message: `User with ID ${id} has been deleted` };
}
}