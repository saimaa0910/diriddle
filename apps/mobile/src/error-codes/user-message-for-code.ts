/**
 * Client-side error leak-stop mapper.
 * NEVER renders raw backend `error.message` or stack traces to end users.
 * Always maps known error codes or HTTP status codes to vetted, safe copy.
 */

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  INVALID_OTP: 'That verification code did not match. Please double-check and try again.',
  OTP_EXPIRED: 'This verification code has expired. Request a new one to continue.',
  OTP_RATE_LIMITED: 'Too many code requests. Please wait a minute before trying again.',
  AGE_VERIFICATION_REQUIRED: 'You must confirm you are 18 or older to use diriddle.',
  ACCOUNT_SUSPENDED: 'This account is temporarily restricted. Visit Safety Center for details.',
  ACCOUNT_DELETED: 'This account is no longer active.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'This item could not be found or has already been removed.',
  COMMUNITY_NOT_FOUND: 'That community is currently unavailable.',
  POST_NOT_FOUND: 'This post is no longer available.',
  COMMENTS_DISABLED: 'Comments have been turned off for this post.',
  CONTENT_BLOCKED_PII: 'For everyone’s privacy, posts cannot include phone numbers, emails, or personal identifiers.',
  CONTENT_MODERATION_REJECTED: 'Your text violates community safety guidelines. Please edit and try again.',
  RATE_LIMITED: 'You are doing that a bit too fast. Please pause and try again shortly.',
  DUPLICATE_REPORT: 'You have already reported this item. Our safety team is reviewing it.',
  CANNOT_BLOCK_SELF: 'You cannot block your own anonymous profile.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  BAD_REQUEST: 'Something in that request could not be processed. Please review and try again.',
  NETWORK_ERROR: 'Unable to reach diriddle servers right now. Check your connection or continue in demo mode.',
  TIMEOUT: 'The request took too long to respond. Please try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our side. Please try again in a moment.',
};

const STATUS_FALLBACKS: Record<number, string> = {
  400: SAFE_ERROR_MESSAGES.BAD_REQUEST,
  401: SAFE_ERROR_MESSAGES.UNAUTHORIZED,
  403: SAFE_ERROR_MESSAGES.FORBIDDEN,
  404: SAFE_ERROR_MESSAGES.NOT_FOUND,
  409: 'This action conflicts with an existing record.',
  422: SAFE_ERROR_MESSAGES.VALIDATION_ERROR,
  429: SAFE_ERROR_MESSAGES.RATE_LIMITED,
  500: SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  502: SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  503: 'diriddle is briefly unavailable for maintenance. Please try again shortly.',
};

export interface ErrorInput {
  code?: string;
  error?: string;
  statusCode?: number;
  response?: {
    status?: number;
    data?: {
      error?: string;
      code?: string;
      statusCode?: number;
    };
  };
}

export function userMessageForCode(input: unknown): string {
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string') {
      const normalized = input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (SAFE_ERROR_MESSAGES[normalized]) {
        return SAFE_ERROR_MESSAGES[normalized];
      }
    }
    return SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
  }

  const err = input as ErrorInput & { isAxiosError?: boolean; code?: string };
  const payload = err.response?.data;
  const rawCode = payload?.code ?? payload?.error ?? err.code ?? err.error;

  if (typeof rawCode === 'string') {
    const normalized = rawCode.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (SAFE_ERROR_MESSAGES[normalized]) {
      return SAFE_ERROR_MESSAGES[normalized];
    }
    if (normalized === 'ERR_NETWORK' || normalized === 'ECONNREFUSED') {
      return SAFE_ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (normalized === 'ECONNABORTED' || normalized === 'ETIMEDOUT') {
      return SAFE_ERROR_MESSAGES.TIMEOUT;
    }
  }

  const status = payload?.statusCode ?? err.response?.status ?? err.statusCode;
  if (typeof status === 'number' && STATUS_FALLBACKS[status]) {
    return STATUS_FALLBACKS[status];
  }

  return SAFE_ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
}

export { SAFE_ERROR_MESSAGES };

