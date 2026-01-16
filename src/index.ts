#!/usr/bin/env node

import 'dotenv/config';
import * as fs from 'fs';
import {
  parseLogFile,
  getAllLogFiles,
  getTodayLogFile,
  getLogFileForDate,
} from './parser.js';
import { groupTasksByAssignee } from './extractor.js';
import { config, getChatworkLogPath } from './config.js';
import { extractTasksWithAI } from './ai-extractor.js';
import { notifyAllTasks, sendDailySummary } from './chatwork.js';
import { addTasksToSheet, clearTasksSheet } from './sheets.js';
import type { DailyLog } from './types.js';

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log('🚀 タスクBot');
  console.log('============');
  console.log(`📁 ログフォルダ: ${getChatworkLogPath()}`);
  console.log('');

  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
  }

  // シートクリア
  if (options.clear) {
    await clearTasksSheet();
  }

  // ログファイルを取得
  const logFiles = getLogFilesToProcess(options);

  if (logFiles.length === 0) {
    console.log('⚠️ 処理対象のログファイルが見つかりません');
    return;
  }

  console.log(`📄 処理対象: ${logFiles.length}ファイル`);

  // ログをパース
  const logs: DailyLog[] = [];
  for (const file of logFiles) {
    const log = parseLogFile(file);
    if (log) {
      logs.push(log);
      console.log(`  ✓ ${log.date}: ${log.rooms.length}ルーム`);
    }
  }

  if (logs.length === 0) {
    console.log('⚠️ パース可能なログがありません');
    return;
  }

  console.log('');

  // AIでタスクを抽出（メンバー限定）
  console.log('🤖 AIでタスク抽出中...');
  const allTasks = await extractTasksWithAI(logs);
  console.log(`✓ 抽出完了: ${allTasks.length}件`);

  if (allTasks.length === 0) {
    console.log('ℹ️ タスクが見つかりませんでした');
    return;
  }

  // 担当者別に表示
  const grouped = groupTasksByAssignee(allTasks);
  console.log('');
  console.log('📊 担当者別タスク数:');
  for (const { assignee, tasks } of grouped) {
    const isSelf = assignee === config.myName ? ' ⭐' : '';
    console.log(`  ${assignee}: ${tasks.length}件${isSelf}`);
  }

  // Google Sheetsに保存
  console.log('');
  console.log('💾 Google Sheetsに保存中...');
  const addedCount = await addTasksToSheet(allTasks);
  console.log(`✓ ${addedCount}件のタスクを追加しました`);

  // Chatwork通知
  if (options.notify) {
    console.log('');
    console.log('📨 Chatwork通知中...');
    await notifyAllTasks(grouped);
    const date = logs[0]?.date || new Date().toISOString().split('T')[0];
    await sendDailySummary(grouped, date);
  }

  console.log('');
  console.log('✨ 完了！');
}

interface Options {
  help: boolean;
  today: boolean;
  all: boolean;
  date?: string;
  notify: boolean;
  clear: boolean;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    help: false,
    today: false,
    all: false,
    notify: false,
    clear: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-t':
      case '--today':
        options.today = true;
        break;
      case '-a':
      case '--all':
        options.all = true;
        break;
      case '-d':
      case '--date':
        options.date = args[++i];
        break;
      case '--notify':
        options.notify = true;
        break;
      case '--clear':
        options.clear = true;
        break;
    }
  }

  if (!options.all && !options.date) {
    options.today = true;
  }

  return options;
}

function getLogFilesToProcess(options: Options): string[] {
  if (options.all) {
    return getAllLogFiles();
  }

  if (options.date) {
    const file = getLogFileForDate(options.date);
    return fs.existsSync(file) ? [file] : [];
  }

  const todayFile = getTodayLogFile();
  if (fs.existsSync(todayFile)) {
    return [todayFile];
  }

  const allFiles = getAllLogFiles();
  return allFiles.length > 0 ? [allFiles[allFiles.length - 1]] : [];
}

function showHelp(): void {
  console.log(`
タスクBot - ChatworkログからAIでタスク抽出 → Google Sheetsに保存

Usage: npm run generate [options]

Options:
  -h, --help      ヘルプを表示
  -t, --today     今日のログのみ処理（デフォルト）
  -a, --all       すべてのログを処理
  -d, --date      指定日付のログを処理（例: -d 2026-01-14）
  --clear         スプシのタスクをクリアしてから実行
  --notify        Chatworkにタスク一覧を通知

Examples:
  npm run generate                  # 今日のログ → AI抽出 → スプシ保存
  npm run generate -- --clear       # クリアしてから実行
  npm run generate -- --notify      # 抽出 + Chatwork通知
`);
}

main().catch(error => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
