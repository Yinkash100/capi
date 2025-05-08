import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { join } from 'path';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: process.env.SMTP_URL,
      preview: true,
      defaults: {
        from: `\"Chat System\" <developer@legacylab.ng>`,
      },
      template: {
        dir: join(__dirname, 'templates'),
        options: {
          strict: true,
        },
      },
    }),
  ConfigModule
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}