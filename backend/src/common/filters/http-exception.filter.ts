import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 * Normalises REST errors into a consistent JSON shape.
 *
 * GraphQL requests MUST be skipped — for those the execution context type is
 * 'graphql', and host.switchToHttp().getRequest() returns undefined.
 * Trying to read request.method on undefined is exactly what caused:
 *   "Cannot read properties of undefined (reading 'method')"
 * Apollo Server handles its own error serialisation. For GraphQL we respond
 * with HTTP 200 + { errors: [...] } rather than re-throwing — re-throwing
 * causes NestJS's fallback handler to access undefined.logIn (Passport's
 * req.logIn) which crashes the process.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ── GraphQL context ─────────────────────────────────────────────────
    // We MUST NOT re-throw here — doing so causes NestJS's fallback error
    // handler to try to access undefined.logIn (Passport's req.logIn) because
    // the fallback treats the GraphQL args array as an HTTP context.
    // Instead, respond with a standard GraphQL error envelope (HTTP 200 with
    // { errors: [...] }) so Apollo Client can surface the error normally.
    // For WebSocket subscriptions there is no HTTP response object, so we
    // simply return — the WS transport will close the operation.
    if (host.getType<GqlContextType>() === 'graphql') {
      const httpCtx  = host.switchToHttp();
      const response = httpCtx.getResponse<Response>();
      if (response && typeof (response as any).status === 'function') {
        let message = 'Internal server error';
        if (exception instanceof HttpException) {
          const res = exception.getResponse();
          message = typeof res === 'string'
            ? res
            : ((res as Record<string, any>).message ?? exception.message);
        } else if (exception instanceof Error) {
          message = exception.message;
        }
        (response as any).status(200).json({ errors: [{ message }] });
      }
      return;
    }

    // ── HTTP context ────────────────────────────────────────────────────
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status: number       = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error                = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error   = exception.message;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message ?? exception.message;
        error   = resObj.error   ?? exception.name;
      }
    } else if (exception instanceof Error) {
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
