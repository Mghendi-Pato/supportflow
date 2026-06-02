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
import { Prisma } from '@prisma/client';

/**
 * Global exception filter — normalises every error into a consistent JSON
 * shape and maps Prisma / infrastructure errors to user-friendly messages.
 *
 * Shape: { statusCode, message, error, timestamp, path }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ── GraphQL context ─────────────────────────────────────────────────
    if (host.getType<GqlContextType>() === 'graphql') {
      const response = host.switchToHttp().getResponse<Response>();
      if (response && typeof (response as any).status === 'function') {
        (response as any).status(200).json({
          errors: [{ message: this.resolveMessage(exception) }],
        });
      }
      return;
    }

    // ── HTTP context ─────────────────────────────────────────────────────
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const { status, message, error } = this.resolveHttpDetails(exception, request);

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Pull a single user-facing message string from any exception type. */
  private resolveMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') return res;
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, any>;
        // class-validator errors come as an array — join them
        if (Array.isArray(r.message)) return r.message.join('; ');
        return r.message ?? exception.message;
      }
    }

    if (this.isPrismaError(exception)) {
      return this.mapPrismaError(exception as Prisma.PrismaClientKnownRequestError);
    }

    if (this.isConnectionError(exception)) {
      return 'Unable to connect to the database. Please try again shortly.';
    }

    return 'Something went wrong. Please try again.';
  }

  /** Derive status code + message + error label from any exception. */
  private resolveHttpDetails(
    exception: unknown,
    request: Request,
  ): { status: number; message: string | string[]; error: string } {
    // ── NestJS HttpException (includes all built-in exceptions) ───────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res    = exception.getResponse();
      let message: string | string[] = exception.message;
      let error = exception.name;

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, any>;
        message = r.message ?? exception.message;
        error   = r.error   ?? exception.name;
      }

      return { status, message, error };
    }

    // ── Prisma known request errors (e.g. unique constraint, not found) ───
    if (this.isPrismaError(exception)) {
      const msg = this.mapPrismaError(exception as Prisma.PrismaClientKnownRequestError);
      const status = this.prismaStatusCode(exception as Prisma.PrismaClientKnownRequestError);
      return { status, message: msg, error: 'Database Error' };
    }

    // ── Database / network connection errors ──────────────────────────────
    if (this.isConnectionError(exception)) {
      this.logger.error(
        `DB connection error on ${request.method} ${request.url}`,
        (exception as Error).stack,
      );
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Unable to connect to the database. Please try again shortly.',
        error: 'Service Unavailable',
      };
    }

    // ── Truly unexpected errors ────────────────────────────────────────────
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our end. Please try again.',
      error: 'Internal Server Error',
    };
  }

  private isPrismaError(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientValidationError
    );
  }

  private isConnectionError(e: unknown): boolean {
    if (e instanceof Prisma.PrismaClientInitializationError) return true;
    if (e instanceof Prisma.PrismaClientRustPanicError) return true;
    // Catch raw "Can't reach database server" errors that surface as
    // PrismaClientKnownRequestError with code P1001 / P1002 / P1008 / P1017
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return ['P1001', 'P1002', 'P1008', 'P1017'].includes(e.code);
    }
    return false;
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): string {
    switch (e.code) {
      // Connection / server errors
      case 'P1001': return 'Unable to connect to the database. Please try again shortly.';
      case 'P1002': return 'The database server timed out. Please try again.';
      case 'P1008': return 'The database operation timed out. Please try again.';
      case 'P1017': return 'The database connection was closed unexpectedly. Please try again.';
      // Constraint violations
      case 'P2002': return 'A record with these details already exists.';
      case 'P2003': return 'This action references a record that does not exist.';
      case 'P2025': return 'The requested record was not found.';
      case 'P2014': return 'This change would violate a required relationship.';
      // Query errors
      case 'P2000': return 'One or more values are too long for this field.';
      case 'P2006': return 'An invalid value was provided for a field.';
      default:
        return 'A database error occurred. Please try again.';
    }
  }

  private prismaStatusCode(e: Prisma.PrismaClientKnownRequestError): number {
    switch (e.code) {
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
        return HttpStatus.SERVICE_UNAVAILABLE;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      case 'P2002':
        return HttpStatus.CONFLICT;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
