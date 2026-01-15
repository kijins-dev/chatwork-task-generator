import { google } from 'googleapis';

// 環境変数から認証情報を取得
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';

/**
 * メンバーシートからPINで認証
 */
export async function authenticateByPin(pin: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'メンバー!A:D',
    });

    const rows = res.data.values || [];
    // ヘッダー行をスキップ
    for (let i = 1; i < rows.length; i++) {
      const [memberPin, name, chatworkId] = rows[i];
      if (memberPin === pin) {
        return { pin: memberPin, name, chatworkId };
      }
    }
    return null;
  } catch (error) {
    console.error('認証エラー:', error);
    throw error;
  }
}

/**
 * タスクを取得
 * シート構造: ID, 担当者, タスク内容, 期限, ステータス, 作成日, ルーム, 優先度
 */
export async function getTasks() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'タスク!A:H',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return []; // ヘッダーのみ

    // ヘッダー行をスキップしてタスクに変換
    return rows.slice(1).map((row, index) => ({
      id: row[0] || String(index + 1),
      assignee: row[1] || '',
      content: row[2] || '',
      deadline: row[3] || '',
      status: row[4] || 'pending',
      createdAt: row[5] || '',
      room: row[6] || '',
      priority: row[7] || '',
    }));
  } catch (error) {
    console.error('タスク取得エラー:', error);
    throw error;
  }
}

/**
 * メンバー一覧を取得
 */
export async function getMembers() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'メンバー!A:D',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1).map((row) => ({
      pin: row[0] || '',
      name: row[1] || '',
      chatworkId: row[2] || '',
      email: row[3] || '',
    }));
  } catch (error) {
    console.error('メンバー取得エラー:', error);
    throw error;
  }
}

/**
 * タスクを完了シートに移動
 */
export async function completeTask(taskId: string) {
  try {
    // 1. タスクシートからタスクを探す
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'タスク!A:H',
    });

    const rows = res.data.values || [];
    let taskRowIndex = -1;
    let taskData: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === taskId) {
        taskRowIndex = i + 1; // 1-indexed
        taskData = rows[i];
        break;
      }
    }

    if (taskRowIndex === -1) {
      throw new Error('タスクが見つかりません');
    }

    // 2. 完了タスクシートに追加（完了日を追加）
    const completedAt = new Date().toLocaleString('ja-JP');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '完了タスク!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[...taskData, completedAt]],
      },
    });

    // 3. タスクシートのシートIDを取得
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const taskSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === 'タスク');
    const taskSheetId = taskSheet?.properties?.sheetId ?? 0;

    // 4. タスクシートから削除
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: taskSheetId,
                dimension: 'ROWS',
                startIndex: taskRowIndex - 1,
                endIndex: taskRowIndex,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('タスク完了エラー:', error);
    throw error;
  }
}

/**
 * タスクを追加
 * シート構造: ID, 担当者, タスク内容, 期限, ステータス, 作成日, ルーム, 優先度
 */
export async function addTask(task: {
  content: string;
  assignee: string;
  deadline?: string;
  room?: string;
  priority?: string;
}) {
  try {
    const id = `T${Date.now()}`;
    const createdAt = new Date().toLocaleString('ja-JP');

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'タスク!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          id,
          task.assignee,
          task.content,
          task.deadline || '',
          'pending',
          createdAt,
          task.room || '',
          task.priority || '',
        ]],
      },
    });

    return id;
  } catch (error) {
    console.error('タスク追加エラー:', error);
    throw error;
  }
}
