import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.localを読み込み
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

async function setupSheets() {
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
    console.error('環境変数が設定されていません。.env.localを確認してください。');
    process.exit(1);
  }

  console.log('Google Sheets APIに接続中...');
  console.log(`スプレッドシートID: ${SPREADSHEET_ID}`);
  console.log(`サービスアカウント: ${SERVICE_ACCOUNT_EMAIL}`);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 既存のシート情報を取得
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    console.log('既存のシート:', existingSheets);

    const requests: any[] = [];

    // 1. タスクシートを作成
    if (!existingSheets.includes('タスク')) {
      requests.push({
        addSheet: {
          properties: {
            title: 'タスク',
            gridProperties: { rowCount: 1000, columnCount: 10 },
          },
        },
      });
    }

    // 2. 完了タスクシートを作成
    if (!existingSheets.includes('完了タスク')) {
      requests.push({
        addSheet: {
          properties: {
            title: '完了タスク',
            gridProperties: { rowCount: 1000, columnCount: 10 },
          },
        },
      });
    }

    // 3. メンバーシートを作成
    if (!existingSheets.includes('メンバー')) {
      requests.push({
        addSheet: {
          properties: {
            title: 'メンバー',
            gridProperties: { rowCount: 100, columnCount: 5 },
          },
        },
      });
    }

    // シートを追加
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests },
      });
      console.log('シートを作成しました');
    } else {
      console.log('すべてのシートは既に存在します');
    }

    // ヘッダー行を設定
    // タスクシート
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'タスク!A1:H1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', '担当者', 'タスク内容', '期限', 'ステータス', '作成日', 'ルーム', '優先度']],
      },
    });
    console.log('タスクシートのヘッダーを設定しました');

    // 完了タスクシート
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '完了タスク!A1:I1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', '担当者', 'タスク内容', '期限', 'ステータス', '作成日', 'ルーム', '優先度', '完了日']],
      },
    });
    console.log('完了タスクシートのヘッダーを設定しました');

    // メンバーシート
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'メンバー!A1:D1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['PIN', '名前', 'ChatworkID', 'メールアドレス']],
      },
    });
    console.log('メンバーシートのヘッダーを設定しました');

    // サンプルメンバーを追加（チームメンバー）
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'メンバー!A2:D10',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['01', '安部直樹', '', ''],
          ['02', '宮内良明', '', ''],
          ['03', '福島正隆', '', ''],
          ['04', '宮里', '', ''],
          ['05', '上坂', '', ''],
          ['06', '安田', '', ''],
          ['07', '松本', '', ''],
          ['08', '森本', '', ''],
          ['09', '小俣', '', ''],
        ],
      },
    });
    console.log('メンバーデータを追加しました');

    console.log('\n✅ セットアップ完了！');
    console.log('\nスプレッドシートURL:');
    console.log(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);

  } catch (error: any) {
    if (error.code === 403) {
      console.error('\n❌ アクセス権限エラー');
      console.error('スプレッドシートにサービスアカウントを編集者として追加してください:');
      console.error(`  ${SERVICE_ACCOUNT_EMAIL}`);
      console.error('\n手順:');
      console.error('1. スプレッドシートを開く');
      console.error('2. 右上の「共有」ボタンをクリック');
      console.error('3. 上記のメールアドレスを追加（編集者権限）');
    } else {
      console.error('エラー:', error.message);
    }
    process.exit(1);
  }
}

setupSheets();
