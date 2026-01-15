import * as fs from 'fs';
import * as path from 'path';
import type { RoomLog, DailyLog } from './types.js';
import { getChatworkLogPath } from './config.js';

/**
 * チャットワークログファイルをパースする
 */
export function parseLogFile(filePath: string): DailyLog | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');

    // ファイル名から日付を抽出（YYYY-MM-DD形式を想定）
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : fileName;

    const rooms = parseRooms(content);

    return {
      date,
      rooms,
    };
  } catch (error) {
    console.error(`ファイルの読み込みエラー: ${filePath}`, error);
    return null;
  }
}

/**
 * ログ内容からルームごとの情報を抽出
 */
function parseRooms(content: string): RoomLog[] {
  const rooms: RoomLog[] = [];

  // Obsidianのcallout形式でルームを分割
  // > [!note] ルーム名 または > [!info] ルーム名
  const roomPattern = /> \[!(note|info)\] (.+?)(?=\n> \[!(?:note|info)\]|\n## |$)/gs;

  // より単純なアプローチ：セクションごとに分割
  const sections = content.split(/(?=^> \[!(?:note|info)\])/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    // ルーム名を抽出
    const roomNameMatch = section.match(/> \[!(?:note|info)\] (.+)/);
    if (!roomNameMatch) continue;

    const roomName = roomNameMatch[1].trim();

    // 次アクションを抽出
    const nextActions = extractNextActions(section);

    // 要対応を抽出
    const requiredActions = extractRequiredActions(section);

    // 自分への関係を抽出
    const selfRelation = extractSelfRelation(section);

    rooms.push({
      name: roomName,
      nextActions,
      requiredActions,
      selfRelation,
    });
  }

  return rooms;
}

/**
 * 「次アクション」セクションからタスクを抽出
 */
function extractNextActions(section: string): string[] {
  const actions: string[] = [];

  // 次アクションセクションを見つける
  const nextActionMatch = section.match(/## 次アクション\n([\s\S]*?)(?=\n## |$)/);
  if (!nextActionMatch) return actions;

  const nextActionContent = nextActionMatch[1];

  // パターン1: - **担当者**：タスク（期限）
  // パターン2: - 担当者が・タスク・期限
  // パターン3: - 誰が・何を・いつまでに: ...
  const lines = nextActionContent.split('\n');

  for (const line of lines) {
    const trimmed = line.replace(/^>\s*/, '').trim();

    // 空行やヘッダーをスキップ
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 「なし」の場合はスキップ
    if (trimmed === 'なし' || trimmed.includes('なし（')) continue;

    // 「誰が・何を・いつまでに: 明確な期限指定なし」のようなプレースホルダーをスキップ
    if (trimmed.includes('誰が・何を・いつまでに')) continue;

    // リスト項目を抽出
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2).trim();
      if (content && content !== 'なし') {
        actions.push(content);
      }
    }
  }

  return actions;
}

/**
 * 「要対応」セクションからタスクを抽出
 */
function extractRequiredActions(section: string): string[] {
  const actions: string[] = [];

  // 要対応セクションを見つける
  const requiredMatch = section.match(/## 要対応\n([\s\S]*?)(?=\n## |$)/);
  if (!requiredMatch) return actions;

  const requiredContent = requiredMatch[1];
  const lines = requiredContent.split('\n');

  for (const line of lines) {
    const trimmed = line.replace(/^>\s*/, '').trim();

    // 空行やヘッダーをスキップ
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 「なし」の場合はスキップ
    if (trimmed === 'なし' || trimmed.startsWith('なし（') || trimmed.startsWith('- なし')) continue;

    // リスト項目を抽出
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2).trim();
      if (content && content !== 'なし') {
        actions.push(content);
      }
    } else if (trimmed && !trimmed.startsWith('>')) {
      // リストマーカーがない場合もキャプチャ
      actions.push(trimmed);
    }
  }

  return actions;
}

/**
 * 「自分への関係」セクションから情報を抽出
 */
function extractSelfRelation(section: string): { hasMention: boolean; hasMessage: boolean } | undefined {
  const relationMatch = section.match(/## 自分への関係\n([\s\S]*?)(?=\n## |$)/);
  if (!relationMatch) return undefined;

  const content = relationMatch[1];

  const hasMention = content.includes('自分宛てメンション: あり') ||
                     /自分宛てメンション:\s*\d+件/.test(content);
  const hasMessage = content.includes('自分の発言: あり') ||
                     /自分の発言:\s*\d+件/.test(content);

  return { hasMention, hasMessage };
}

/**
 * 指定された日付のログファイルを取得
 */
export function getLogFileForDate(date: string): string {
  const logPath = getChatworkLogPath();
  return path.join(logPath, `${date}.md`);
}

/**
 * すべてのログファイルを取得
 */
export function getAllLogFiles(): string[] {
  const logPath = getChatworkLogPath();

  try {
    const files = fs.readdirSync(logPath);
    return files
      .filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map(f => path.join(logPath, f))
      .sort();
  } catch (error) {
    console.error('ログフォルダの読み込みエラー:', error);
    return [];
  }
}

/**
 * 今日のログファイルパスを取得
 */
export function getTodayLogFile(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return getLogFileForDate(dateStr);
}
