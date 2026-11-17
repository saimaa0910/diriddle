import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('executes actions successfully when closed', async () => {
    const breaker = new CircuitBreaker('test-service', { failureThreshold: 3 });
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('trips to OPEN state after reaching failure threshold and executes fallback', async () => {
    const breaker = new CircuitBreaker('failing-service', { failureThreshold: 2, resetTimeoutMs: 100 });

    const failingAction = async () => {
      throw new Error('Remote down');
    };

    // First failure
    await expect(breaker.execute(failingAction)).rejects.toThrow('Remote down');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Second failure - trips breaker
    await expect(breaker.execute(failingAction)).rejects.toThrow('Remote down');
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Third call fast-fails or executes fallback
    const fallbackResult = await breaker.execute(failingAction, async () => 'fallback-value');
    expect(fallbackResult).toBe('fallback-value');
  });
});
