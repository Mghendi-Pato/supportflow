import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 * Normalises all errors into a consistent JSON shape:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   timestamp: string,
 *   path: string,
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.message;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message ?? exception.message;
        error = resObj.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      // Unexpected errors — log fully, return safe message
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
