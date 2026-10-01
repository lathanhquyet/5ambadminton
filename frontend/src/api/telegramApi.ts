import { apiClient } from './client';

export interface AdminTelegramSettingsDTO {
  enabled: boolean;
  hasBotToken: boolean;
  configured: boolean;
  chatId: string;
}

export interface UpdateTelegramSettingsParams {
  enabled?: boolean;
  botToken?: string;
  chatId?: string;
}

export async function getTelegramSettings(): Promise<AdminTelegramSettingsDTO> {
  const res = await apiClient.get('/admin/telegram-settings');
  return res.data.data;
}

export async function updateTelegramSettings(
  params: UpdateTelegramSettingsParams
): Promise<AdminTelegramSettingsDTO> {
  const res = await apiClient.put('/admin/telegram-settings', params);
  return res.data.data;
}

export async function testTelegram(): Promise<{ message: string }> {
  const res = await apiClient.post('/admin/telegram-settings/test');
  return res.data.data;
}
