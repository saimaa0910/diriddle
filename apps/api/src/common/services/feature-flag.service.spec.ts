import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    service = new FeatureFlagService();
  });

  it('evaluates 100% rollout flags as enabled for all users', () => {
    expect(service.isEnabled('video_uploads_enabled', { userId: 'user-1' })).toBe(true);
    expect(service.isEnabled('video_uploads_enabled', { userId: 'user-2' })).toBe(true);
  });

  it('evaluates deterministic percentage rollout for users', () => {
    // 50% rollout flag
    const result1 = service.isEnabled('realtime_reactions_v2', { userId: 'user-alpha' });
    const result2 = service.isEnabled('realtime_reactions_v2', { userId: 'user-alpha' });
    // Must be deterministic
    expect(result1).toBe(result2);
  });

  it('supports runtime flag modification and emergency rollback', () => {
    service.setFlag({ key: 'new_feature', enabled: true, rolloutPercentage: 100 });
    expect(service.isEnabled('new_feature')).toBe(true);

    service.rollback('new_feature');
    expect(service.isEnabled('new_feature')).toBe(false);
  });
});
