import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Global response interceptor.
 * Wraps every successful response in:
 * {
 *   success: true,
 *   data: <original response>,
 *   timestamp: string,
 * }
 *
 * Skips wrapping if the response is already in this shape
 * (e.g. paginated responses that return their own structure).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
