import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

interface IdempotencyRecord {
  status: 'PENDING' | 'RESOLVED';
  response?: any;
  statusCode?: number;
  createdAt: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private static cache = new Map<string, IdempotencyRecord>();
  private static TTL_MS = 60000; // 60 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method?.toUpperCase();

    // Only apply idempotency to mutating HTTP methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) {
      return next.handle();
    }

    const userId = request.user?.id || 'anonymous';
    const cacheKey = `${userId}:${method}:${request.url}:${idempotencyKey}`;
    const now = Date.now();

    // Clean expired entries
    for (const [key, record] of IdempotencyInterceptor.cache.entries()) {
      if (now - record.createdAt > IdempotencyInterceptor.TTL_MS) {
        IdempotencyInterceptor.cache.delete(key);
      }
    }

    const existing = IdempotencyInterceptor.cache.get(cacheKey);
    if (existing) {
      if (existing.status === 'PENDING') {
        throw new ConflictException({
          error: 'CONCURRENT_REQUEST_CONFLICT',
          message: 'A request with this idempotency key is currently being processed',
        });
      }
      if (existing.status === 'RESOLVED') {
        response.setHeader('x-cache-idempotent', 'true');
        if (existing.statusCode) {
          response.status(existing.statusCode);
        }
        return of(existing.response);
      }
    }

    IdempotencyInterceptor.cache.set(cacheKey, {
      status: 'PENDING',
      createdAt: now,
    });

    return next.handle().pipe(
      tap({
        next: (resData) => {
          IdempotencyInterceptor.cache.set(cacheKey, {
            status: 'RESOLVED',
            response: resData,
            statusCode: response.statusCode,
            createdAt: Date.now(),
          });
        },
        error: () => {
          IdempotencyInterceptor.cache.delete(cacheKey);
        },
      }),
    );
  }
}
