import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ErrorEnvelope } from '@diriddle/shared-types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        error = HttpStatus[statusCode] || 'HTTP_ERROR';
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        error =
          typeof body.error === 'string'
            ? body.error
            : HttpStatus[statusCode] || 'HTTP_ERROR';
        if (Array.isArray(body.message)) {
          message = body.message.join('; ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        } else {
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error [${requestId}] ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    const envelope: ErrorEnvelope = {
      statusCode,
      error,
      message,
      requestId,
    };

    response.status(statusCode).json(envelope);
  }
}
