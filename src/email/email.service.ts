import { Injectable } from '@nestjs/common';
import * as Mail from 'nodemailer/lib/mailer';
import { LoggingService } from '../logging/logging.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {

  constructor(private readonly mailerService: MailerService, private logger: LoggingService, private configService:ConfigService) {}

  async sendMail(options: Mail.Options) {
    try {
      const info = await this.mailerService.sendMail({
        ...options,
      });
      
      this.logger.info('EmailService', `Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error('EmailService', `Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/auth/verify?token=${token}`;
    
    await this.sendMail({
      to: email,
      subject: 'Email Verification',
      html: `
        <h3>Welcome to Chat API!</h3>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">Verify Email</a></p>
        <p>If you did not create an account, please ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;
    
    await this.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h3>Password Reset</h3>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
    });
  }
}