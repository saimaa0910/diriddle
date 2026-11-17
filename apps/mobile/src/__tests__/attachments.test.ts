import { attachmentsApi } from '../api/attachments.api';

describe('attachmentsApi', () => {
  it('initiates upload session and returns mock/demo credentials when in demo session', async () => {
    const res = await attachmentsApi.initiate({
      type: 'IMAGE',
      mime_type: 'image/jpeg',
      size_bytes: 1024 * 500,
    });

    expect(res.attachment_id).toBeDefined();
    expect(res.upload_url).toContain('presigned');
    expect(res.storage_key).toBeDefined();
    expect(res.max_size_bytes).toBeGreaterThan(0);
  });

  it('confirms upload and returns ready status with media url', async () => {
    const res = await attachmentsApi.confirm('att-12345');

    expect(res.id).toBe('att-12345');
    expect(res.status).toBe('READY');
    expect(res.url).toContain('https://');
  });
});
