import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import https from 'https';

export interface TelegramSettingsInternal {
  id: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
}

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

export function getTelegramSettingsInternal(dbInstance?: DatabaseType): TelegramSettingsInternal {
  const db = dbInstance || defaultDb;
  const row = db.prepare('SELECT * FROM telegram_settings ORDER BY created_at DESC LIMIT 1').get() as any;

  if (!row) {
    return {
      id: 'default',
      botToken: '',
      chatId: '',
      enabled: false
    };
  }

  return {
    id: row.id,
    botToken: row.bot_token || '',
    chatId: row.chat_id || '',
    enabled: Boolean(row.enabled)
  };
}

export function getAdminTelegramSettingsDTO(dbInstance?: DatabaseType): AdminTelegramSettingsDTO {
  const settings = getTelegramSettingsInternal(dbInstance);
  const hasToken = Boolean(settings.botToken.trim());
  const hasChat = Boolean(settings.chatId.trim());

  return {
    enabled: settings.enabled,
    hasBotToken: hasToken,
    configured: hasToken && hasChat,
    chatId: settings.chatId
  };
}

export function updateTelegramSettings(
  dbInstance: DatabaseType | undefined,
  params: UpdateTelegramSettingsParams
): AdminTelegramSettingsDTO {
  const db = dbInstance || defaultDb;
  const current = getTelegramSettingsInternal(db);

  let newBotToken = current.botToken;
  if (params.botToken !== undefined) {
    const trimmed = params.botToken.trim();
    // Only update botToken if a non-empty string is provided
    if (trimmed.length > 0) {
      newBotToken = trimmed;
    }
  }

  const newChatId = params.chatId !== undefined ? params.chatId.trim() : current.chatId;
  const newEnabled = params.enabled !== undefined ? Boolean(params.enabled) : current.enabled;

  const existing = db.prepare('SELECT id FROM telegram_settings ORDER BY created_at DESC LIMIT 1').get() as any;

  if (existing) {
    db.prepare(`
      UPDATE telegram_settings
      SET bot_token = ?, chat_id = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newBotToken, newChatId, newEnabled ? 1 : 0, existing.id);
  } else {
    const newId = 'tg_set_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO telegram_settings (id, bot_token, chat_id, enabled)
      VALUES (?, ?, ?, ?)
    `).run(newId, newBotToken, newChatId, newEnabled ? 1 : 0);
  }

  return getAdminTelegramSettingsDTO(db);
}

export async function sendTelegramMessageRaw(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Chưa cấu hình Telegram Bot Token hoặc Chat ID.' };
  }

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: text
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        family: 4,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, message: 'Đã gửi Telegram alert thành công.' });
          } else {
            resolve({
              success: false,
              error: `Telegram API error status ${res.statusCode}: ${responseData}`
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `Network error when calling Telegram API: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Telegram API request timed out.' });
      });

      req.write(payload);
      req.end();
    } catch (err: any) {
      resolve({ success: false, error: `Exception sending Telegram message: ${err.message}` });
    }
  });
}

export async function sendTelegramNotification(
  dbInstance: DatabaseType | undefined,
  text: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const settings = getTelegramSettingsInternal(dbInstance);

  if (!settings.enabled) {
    return { success: false, error: 'Telegram Bot đang bị vô hiệu hóa.' };
  }

  if (!settings.botToken || !settings.chatId) {
    return { success: false, error: 'Telegram Bot chưa được cấu hình đầy đủ (thiếu Bot Token hoặc Chat ID).' };
  }

  return (exports as any).sendTelegramMessageRaw(settings.botToken, settings.chatId, text);
}
