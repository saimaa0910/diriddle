import { RiskScoringService } from './risk-scoring.service';

describe('RiskScoringService', () => {
  let service: RiskScoringService;

  beforeEach(() => {
    service = new RiskScoringService();
  });

  it('allows safe, normal discussion content', () => {
    const res = service.evaluateContent('Where is the best filter coffee in Indiranagar?');
    expect(res.score).toBe(0.0);
    expect(res.signals).toHaveLength(0);
    expect(res.recommendation).toBe('ALLOW');
  });

  it('flags content exposing mobile numbers or Aadhaar patterns', () => {
    const res = service.evaluateContent('Call me at 9876543210 for tickets');
    expect(res.score).toBeGreaterThanOrEqual(0.5);
    expect(res.signals).toContain('PHONE_NUMBER_EXPOSURE');
    expect(res.recommendation).toBe('FLAG_FOR_REVIEW');
  });

  it('auto-blocks severe toxicity or threats', () => {
    const res = service.evaluateContent('I am going to plant a bomb at the station');
    expect(res.score).toBeGreaterThanOrEqual(0.7);
    expect(res.recommendation).toBe('AUTO_BLOCK');
  });
});
