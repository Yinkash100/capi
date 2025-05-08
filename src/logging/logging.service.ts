import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class LoggingService {
  private logger: winston.Logger;

  constructor() {
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );

    // Create transport for console
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    });

    // Create transport for files with rotation
    const fileTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    });

    // Create error log transport
    const errorTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: logFormat,
    });

    // Create logger with transports
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      transports: [consoleTransport, fileTransport, errorTransport],
    });
  }

  debug(context: string, message: string) {
    this.logger.debug(`[${context}] ${message}`);
  }

  info(context: string, message: string) {
    this.logger.info(`[${context}] ${message}`);
  }

  warn(context: string, message: string) {
    this.logger.warn(`[${context}] ${message}`);
  }

  error(context: string, message: string, trace?: string) {
    this.logger.error(`[${context}] ${message}${trace ? `\n${trace}` : ''}`);
  }
}