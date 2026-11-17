import { SAFE_ERROR_MESSAGES, userMessageForCode } from '../error-codes/user-message-for-code';

describe('userMessageForCode (client leak-stop)', () => {
  it('never leaks raw backend error.message strings', () => {
    const rawSqlLeak = {
      response: {
        status: 500,
        data: {
          error: 'INTERNAL_SERVER_ERROR',
          message: 'PrismaClientKnownRequestError: relation "users" password_hash column failed',
        },
      },
    };
    const result = userMessageForCode(rawSqlLeak);
    expect(result).toBe(SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
    expect(result).not.toContain('Prisma');
    expect(result).not.toContain('password_hash');
  });

  it('maps known error codes accurately', () => {
    expect(userMessageForCode({ error: 'INVALID_OTP' })).toBe(SAFE_ERROR_MESSAGES.INVALID_OTP);
    expect(
      userMessageForCode({ response: { status: 400, data: { code: 'CONTENT_BLOCKED_PII' } } })
    ).toBe(SAFE_ERROR_MESSAGES.CONTENT_BLOCKED_PII);
    expect(userMessageForCode({ code: 'ERR_NETWORK' })).toBe(SAFE_ERROR_MESSAGES.NETWORK_ERROR);
  });

  it('falls back to HTTP status message when code is unknown', () => {
    const result = userMessageForCode({
      response: {
        status: 429,
        data: { error: 'SOME_UNKNOWN_INTERNAL_CODE', message: 'Redis key burst limit' },
      },
    });
    expect(result).toBe(SAFE_ERROR_MESSAGES.RATE_LIMITED);
    expect(result).not.toContain('Redis');
  });

  it('returns generic safe error for arbitrary strings or nulls', () => {
    expect(userMessageForCode(null)).toBe(SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
    expect(userMessageForCode('stack trace line 42')).toBe(
      SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    );
  });
});

