import type { Config } from './types.js';

/**
 * デフォルト設定
 */
export const config: Config = {
  // Obsidian Vaultのパス（環境変数から取得）
  obsidianPath: process.env.OBSIDIAN_PATH || '',

  // チャットワークログのフォルダ名
  chatworkLogFolder: '08_Chatworkログ',

  // タスク出力先フォルダ名
  taskOutputFolder: '00_タスクBot',

  // 自分の名前（ログ上での表記）
  myName: '安部直樹',

  // Chatwork設定
  chatwork: {
    // タスク通知用ルームID
    taskRoomId: '420216149',
    // APIトークン（環境変数から取得）
    apiToken: process.env.CHATWORK_API_TOKEN || '',
  },

  // Claude API設定（タスク判定用）
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-haiku-20240307', // 高速・低コスト
  },
};

/**
 * パスを結合するヘルパー
 */
export function getPath(...segments: string[]): string {
  return segments.join('\\');
}

/**
 * チャットワークログのフルパスを取得
 */
export function getChatworkLogPath(): string {
  return getPath(config.obsidianPath, config.chatworkLogFolder);
}

/**
 * タスク出力先のフルパスを取得
 */
export function getTaskOutputPath(): string {
  return getPath(config.obsidianPath, config.taskOutputFolder);
}
