import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Global response interceptor.
 * Wraps REST responses in { success, data, timestamp }.
 *
 * GraphQL resolvers MUST be excluded — Apollo Server owns the response
 * envelope ({ data, errors }) and wrapping the resolver's return value
 * would corrupt the shape Apollo Server expects to serialize against
 * the GraphQL schema types.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip for GraphQL — Apollo Server manages its own response format
    if (context.getType<GqlContextType>() === 'graphql') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
