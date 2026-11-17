import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';

export interface InitiateUploadInput {
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  mime_type: string;
  size_bytes: number;
  duration_seconds?: number;
  post_id?: string;
  comment_id?: string;
}

export interface InitiateUploadResponse {
  attachment_id: string;
  upload_url: string;
  storage_key: string;
  expires_in_seconds: number;
  max_size_bytes: number;
}

export interface ConfirmUploadResponse {
  id: string;
  status: string;
  url: string;
  thumbnail_url?: string;
}

export const attachmentsApi = {
  async initiate(input: InitiateUploadInput): Promise<InitiateUploadResponse> {
    if (isDemoSession()) {
      return {
        attachment_id: `att-${Date.now()}`,
        upload_url: 'https://demo-upload.diriddle.in/presigned',
        storage_key: `uploads/demo-${Date.now()}`,
        expires_in_seconds: 900,
        max_size_bytes: 15 * 1024 * 1024,
      };
    }

    try {
      const res = await apiClient.post<InitiateUploadResponse>('/attachments/initiate', input);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          attachment_id: `att-${Date.now()}`,
          upload_url: 'https://demo-upload.diriddle.in/presigned',
          storage_key: `uploads/demo-${Date.now()}`,
          expires_in_seconds: 900,
          max_size_bytes: 15 * 1024 * 1024,
        };
      }
      throw error;
    }
  },

  async confirm(attachmentId: string): Promise<ConfirmUploadResponse> {
    if (isDemoSession()) {
      return {
        id: attachmentId,
        status: 'READY',
        url: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=800&q=80',
      };
    }

    try {
      const res = await apiClient.post<ConfirmUploadResponse>(`/attachments/${attachmentId}/confirm`);
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          id: attachmentId,
          status: 'READY',
          url: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=800&q=80',
        };
      }
      throw error;
    }
  },
};
