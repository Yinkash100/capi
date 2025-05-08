import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from '../user/user.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    const payload = { 
      sub: user.id, 
      email: user.email,
      role: user.role 
    };

    this.logger.info('AuthService', `User logged in: ${user.email}`);
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async signup(signupDto: SignupDto) {
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(signupDto.email);
    
    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    
    // Generate verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // Token valid for 24 hours

    // Create user
    const newUser = await this.prisma.user.create({
      data: {
        email: signupDto.email,
        password: hashedPassword,
        firstName: signupDto.firstName,
        lastName: signupDto.lastName,
        country: signupDto.country,
        verificationToken,
        verificationExpires,
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(newUser.email, verificationToken);
    
    this.logger.info('AuthService', `User registered: ${newUser.email}`);
    
    return { 
      message: 'Registration successful! Please check your email to verify your account.',
      userId: newUser.id,
    };
  }

  async verifyEmail(token: string) {
    // Find user with verification token
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationExpires: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user to verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });

    this.logger.info('AuthService', `Email verified for user: ${user.email}`);
    
    return { message: 'Email verification successful! You can now log in.' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.userService.findByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists or not for security reasons
      return { message: 'If your email is registered, you will receive a password reset link.' };
    }

    // Generate reset token
    const resetPasswordToken = uuidv4();
    const resetPasswordExpires = new Date();
    resetPasswordExpires.setHours(resetPasswordExpires.getHours() + 1); // Token valid for 1 hour

    // Update user with reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetPasswordToken);
    
    this.logger.info('AuthService', `Password reset requested for: ${user.email}`);
    
    return { message: 'If your email is registered, you will receive a password reset link.' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Find user with reset token
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    this.logger.info('AuthService', `Password reset completed for: ${user.email}`);
    
    return { message: 'Password has been successfully reset. You can now log in with your new password.' };
  }
}