import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before opening
  resetTimeoutMs?: number; // How long to stay open before testing half-open
  timeoutMs?: number; // Timeout per execution
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(
    private readonly name: string,
    options?: CircuitBreakerOptions,
  ) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 30000;
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit [${this.name}] shifted to HALF_OPEN probe state`);
      }
    }
    return this.state;
  }

  async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      this.logger.warn(`Circuit [${this.name}] is OPEN. Fast-failing.`);
      if (fallback) return fallback();
      throw new Error(`CircuitBreaker [${this.name}] is OPEN`);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      if (fallback) return fallback();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.logger.log(`Circuit [${this.name}] restored to CLOSED state`);
    }
  }

  private onFailure(err: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.logger.warn(`Circuit [${this.name}] failure count: ${this.failureCount}/${this.failureThreshold}. Error: ${err.message}`);

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.error(`Circuit [${this.name}] tripped to OPEN state!`);
    }
  }
}
