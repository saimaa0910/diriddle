import { ExecutionContext, CallHandler, ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor();
  });

  function createMockContext(method: string, key?: string) {
    const headers: Record<string, string> = {};
    if (key) headers['x-idempotency-key'] = key;

    const req = {
      method,
      url: '/v1/posts',
      headers,
      user: { id: 'test-user-1' },
    };
    const res = {
      statusCode: 201,
      setHeader: jest.fn(),
      status: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  }

  it('passes through GET requests without idempotency checking', (done) => {
    const ctx = createMockContext('GET', 'key-1');
    const handler: CallHandler = { handle: () => of({ data: 'ok' }) };

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ data: 'ok' });
        done();
      },
    });
  });

  it('returns cached response for duplicate POST request with same idempotency key', (done) => {
    const ctx = createMockContext('POST', 'unique-key-123');
    const handler: CallHandler = { handle: () => of({ id: 'post-new-1', created: true }) };

    // First request
    interceptor.intercept(ctx, handler).subscribe({
      next: (val1) => {
        expect(val1).toEqual({ id: 'post-new-1', created: true });

        // Second request with same key
        const ctx2 = createMockContext('POST', 'unique-key-123');
        interceptor.intercept(ctx2, handler).subscribe({
          next: (val2) => {
            expect(val2).toEqual({ id: 'post-new-1', created: true });
            done();
          },
        });
      },
    });
  });
});
