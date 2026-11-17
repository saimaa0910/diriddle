import { DomainEventBusService } from './domain-event-bus.service';

describe('DomainEventBusService', () => {
  let eventBus: DomainEventBusService;

  beforeEach(() => {
    eventBus = new DomainEventBusService();
  });

  it('publishes domain events, redacting sensitive fields from payloads', async () => {
    let receivedPayload: any = null;
    eventBus.subscribe('USER_REGISTERED', (event) => {
      receivedPayload = event.payload;
    });

    await eventBus.publish('USER_REGISTERED', 'USER', 'user-123', {
      username: 'Anonymous #1234',
      phone: '+919888888888',
      email: 'test@example.com',
      city: 'Bengaluru',
    });

    expect(receivedPayload).toBeTruthy();
    expect(receivedPayload.username).toBe('Anonymous #1234');
    expect(receivedPayload.city).toBe('Bengaluru');
    expect(receivedPayload.phone).toBe('[REDACTED_PRIVACY]');
    expect(receivedPayload.email).toBe('[REDACTED_PRIVACY]');
  });

  it('routes failed events to the dead-letter queue and supports retry', async () => {
    let attempt = 0;
    eventBus.subscribe('CRITICAL_TASK', () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('Transient network error');
      }
    });

    const published = await eventBus.publish('CRITICAL_TASK', 'TASK', 't-1', { data: 'test' });
    const dlq = eventBus.getDeadLetterQueue();
    expect(dlq).toHaveLength(1);
    expect(dlq[0].event.id).toBe(published.id);

    // Retry dead-letter entry
    const retried = await eventBus.retryDeadLetter(published.id);
    expect(retried).toBe(true);
    expect(attempt).toBe(2);
    expect(eventBus.getDeadLetterQueue()).toHaveLength(0);
  });
});
