import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Mail from 'nodemailer/lib/mailer';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: this.configService.get('MAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
  }

  async sendMail(options: Mail.Options) {
    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM'),
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