import { google } from 'googleapis';
import type { Task } from './types.js';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

let sheetsClient: any = null;
let memberListCache: string[] | null = null;
let memberIdMapCache: Map<string, string> | null = null;
let excludedRoomsCache: string[] | null = null;

function getSheets() {
  if (!sheetsClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: SERVICE_ACCOUNT_EMAIL,
        private_key: PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

/**
 * メンバーシートから登録メンバーの名前一覧を取得
 */
export async function getMemberNames(): Promise<string[]> {
  if (memberListCache) return memberListCache;

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'メンバー!B:B', // 名前列
  });

  const rows = res.data.values || [];
  // ヘッダー行をスキップ
  const members = rows.slice(1).map((row: string[]) => row[0]).filter(Boolean);
  memberListCache = members;
  console.log(`📋 登録メンバー: ${members.join(', ')}`);
  return members;
}

/**
 * チャットワークID → 名前のマッピングを取得
 */
export async function getMemberIdMap(): Promise<Map<string, string>> {
  if (memberIdMapCache) return memberIdMapCache;

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'メンバー!A:B', // A列: チャットワークID, B列: 名前
  });

  const rows = res.data.values || [];
  const idMap = new Map<string, string>();

  // ヘッダー行をスキップ
  for (const row of rows.slice(1)) {
    const chatworkId = row[0]?.toString().trim();
    const name = row[1]?.toString().trim();
    if (chatworkId && name) {
      idMap.set(chatworkId, name);
    }
  }

  memberIdMapCache = idMap;
  console.log(`📋 チャットワークIDマッピング: ${idMap.size}件`);
  return idMap;
}

/**
 * 除外ルームシートから除外するルーム名一覧を取得
 */
export async function getExcludedRooms(): Promise<string[]> {
  if (excludedRoomsCache) return excludedRoomsCache;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '除外ルーム!A:A',
    });

    const rows = res.data.values || [];
    // ヘッダー行をスキップ
    const rooms = rows.slice(1).map((row: string[]) => row[0]?.trim()).filter(Boolean);
    excludedRoomsCache = rooms;
    if (rooms.length > 0) {
      console.log(`🚫 除外ルーム: ${rooms.length}件`);
    }
    return rooms;
  } catch (error) {
    // シートが存在しない場合は空配列を返す
    console.log('ℹ️ 除外ルームシートがないため、全ルームを処理します');
    excludedRoomsCache = [];
    return [];
  }
}

/**
 * タスクをスプレッドシートに追加
 */
export async function addTasksToSheet(tasks: Task[]): Promise<number> {
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    console.log('⚠️ Google Sheets認証情報が未設定');
    return 0;
  }

  if (tasks.length === 0) return 0;

  const sheets = getSheets();
  const now = new Date().toLocaleString('ja-JP');

  // メンバーシートの登録メンバーのみ対象
  const members = await getMemberNames();
  const memberTasks = tasks.filter(t =>
    members.some(m => t.assignee === m || t.assignee.includes(m) || m.includes(t.assignee))
  );
  console.log(`👥 登録メンバーのタスク: ${memberTasks.length}件`);

  if (memberTasks.length === 0) {
    console.log('ℹ️ 登録メンバーのタスクはありません');
    return 0;
  }

  // 既存のタスクを取得して重複チェック
  const existing = await getExistingTasks();
  const existingKeys = new Set(existing.map(t => `${t.assignee}|${t.content}`));

  // 重複を除外
  const newTasks = memberTasks.filter(t => !existingKeys.has(`${t.assignee}|${t.content}`));

  if (newTasks.length === 0) {
    console.log('ℹ️ 新規タスクはありません（全て重複）');
    return 0;
  }

  // シート構造: ID, 担当者, タスク内容, 期限, ステータス, 作成日, ルーム, 優先度
  const rows = newTasks.map((task, i) => [
    `T${Date.now()}-${i}`,
    task.assignee,
    task.content,
    task.deadline || '',
    'pending',
    now,
    task.room || '',
    task.type === 'required_action' ? '高' : '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'タスク!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  return newTasks.length;
}

/**
 * 既存のタスクを取得
 */
async function getExistingTasks(): Promise<{ assignee: string; content: string }[]> {
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'タスク!A:C',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1).map((row: string[]) => ({
      assignee: row[1] || '',
      content: row[2] || '',
    }));
  } catch {
    return [];
  }
}

/**
 * タスクシートをクリア（ヘッダー以外削除）
 */
export async function clearTasksSheet(): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'タスク!A2:H',
  });
  console.log('🗑️ タスクシートをクリアしました');
}

/**
 * スプレッドシートからタスク一覧を取得
 */
export async function getTasksFromSheet(): Promise<Task[]> {
  if (!SPREADSHEET_ID) return [];

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'タスク!A:H',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row: string[]) => ({
    assignee: row[1] || '',
    content: row[2] || '',
    deadline: row[3] || undefined,
    status: (row[4] as 'pending' | 'completed') || 'pending',
    room: row[6] || '',
    sourceDate: row[5] || '',
    type: row[7] === '高' ? 'required_action' : 'next_action',
  })) as Task[];
}
