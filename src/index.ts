#!/usr/bin/env node

import * as fs from 'fs';
import {
  parseLogFile,
  getAllLogFiles,
  getTodayLogFile,
  getLogFileForDate,
} from './parser.js';
import {
  extractTasksFromLog,
  extractTasksFromLogs,
  groupTasksByAssignee,
  filterMyTasks,
  filterTeamTasks,
} from './extractor.js';
import {
  writeAssigneeTasks,
  writeAllMembersTasks,
  mergeWithExistingTasks,
  writeDailyReport,
} from './writer.js';
import { config, getChatworkLogPath } from './config.js';
import { validateTasksWithAI } from './ai.js';
import { notifyAllTasks, sendDailySummary } from './chatwork.js';
import type { DailyLog, Task } from './types.js';

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  console.log('🚀 チャットワークタスク生成ツール');
  console.log('================================');
  console.log(`📂 Obsidian: ${config.obsidianPath}`);
  console.log(`📁 ログフォルダ: ${getChatworkLogPath()}`);
  console.log('');

  // コマンドライン引数を解析
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
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

  // タスクを抽出
  let allTasks = extractTasksFromLogs(logs);
  console.log(`📋 抽出されたタスク: ${allTasks.length}件`);

  // AI判定が有効な場合
  if (options.ai && allTasks.length > 0) {
    console.log('🤖 AIによるタスク判定中...');
    allTasks = await validateTasksWithAI(allTasks);
    console.log(`✓ AI判定後: ${allTasks.length}件`);
  }

  if (allTasks.length === 0) {
    console.log('ℹ️ タスクが見つかりませんでした');
    return;
  }

  // 出力モードに応じて処理
  if (options.team) {
    // チーム全体のタスク
    const teamTasks = filterTeamTasks(allTasks);
    const grouped = groupTasksByAssignee(teamTasks);

    console.log(`👥 チームメンバーのタスク: ${teamTasks.length}件`);
    console.log('');

    writeAssigneeTasks(grouped);
    writeAllMembersTasks(grouped);
  } else if (options.my) {
    // 自分のタスクのみ
    const myTasks = filterMyTasks(allTasks);
    console.log(`⭐ 自分のタスク: ${myTasks.length}件`);
    console.log('');

    mergeWithExistingTasks(myTasks);
  } else if (options.report) {
    // レポート生成
    const date = logs[0]?.date || new Date().toISOString().split('T')[0];
    writeDailyReport(allTasks, date);
  } else {
    // デフォルト: 全て実行
    const grouped = groupTasksByAssignee(allTasks);

    console.log('');
    console.log('📊 担当者別タスク数:');
    for (const { assignee, tasks } of grouped) {
      const isSelf = assignee === config.myName ? ' ⭐' : '';
      console.log(`  ${assignee}: ${tasks.length}件${isSelf}`);
    }
    console.log('');

    // 各出力を実行
    writeAssigneeTasks(grouped);
    writeAllMembersTasks(grouped);

    // 自分のタスクは既存ファイルにマージ
    const myTasks = filterMyTasks(allTasks);
    if (myTasks.length > 0) {
      mergeWithExistingTasks(myTasks);
    }

    // レポート生成
    const date = logs[0]?.date || new Date().toISOString().split('T')[0];
    writeDailyReport(allTasks, date);
  }

  // Chatwork通知
  if (options.notify) {
    console.log('');
    const grouped = groupTasksByAssignee(allTasks);
    await notifyAllTasks(grouped);
    const date = logs[0]?.date || new Date().toISOString().split('T')[0];
    await sendDailySummary(grouped, date);
  }

  console.log('');
  console.log('✨ 完了！');
}

/**
 * コマンドライン引数をパース
 */
interface Options {
  help: boolean;
  today: boolean;
  all: boolean;
  date?: string;
  team: boolean;
  my: boolean;
  report: boolean;
  ai: boolean;
  notify: boolean;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    help: false,
    today: false,
    all: false,
    team: false,
    my: false,
    report: false,
    ai: false,
    notify: false,
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
      case '--team':
        options.team = true;
        break;
      case '--my':
        options.my = true;
        break;
      case '--report':
        options.report = true;
        break;
      case '--ai':
        options.ai = true;
        break;
      case '--notify':
        options.notify = true;
        break;
    }
  }

  // デフォルトは今日
  if (!options.all && !options.date) {
    options.today = true;
  }

  return options;
}

/**
 * 処理対象のログファイルを取得
 */
function getLogFilesToProcess(options: Options): string[] {
  if (options.all) {
    return getAllLogFiles();
  }

  if (options.date) {
    const file = getLogFileForDate(options.date);
    return fs.existsSync(file) ? [file] : [];
  }

  // 今日のログ
  const todayFile = getTodayLogFile();
  if (fs.existsSync(todayFile)) {
    return [todayFile];
  }

  // 今日のログがなければ最新のログを使用
  const allFiles = getAllLogFiles();
  return allFiles.length > 0 ? [allFiles[allFiles.length - 1]] : [];
}

/**
 * ヘルプを表示
 */
function showHelp(): void {
  console.log(`
チャットワークタスク生成ツール

Usage: npm run generate [options]

Options:
  -h, --help      ヘルプを表示
  -t, --today     今日のログのみ処理（デフォルト）
  -a, --all       すべてのログを処理
  -d, --date      指定日付のログを処理（例: -d 2026-01-14）
  --team          チームメンバーのタスクを個別ファイルに出力
  --my            自分のタスクのみ抽出して未完了タスクにマージ
  --report        日次レポートのみ生成
  --ai            AIでタスク候補を判定（ANTHROPIC_API_KEY必要）
  --notify        Chatworkにタスク一覧を通知（CHATWORK_API_TOKEN必要）

Examples:
  npm run generate                  # 今日のログからタスク生成
  npm run generate -- --all         # 全ログからタスク生成
  npm run generate -- -d 2026-01-14 # 指定日のログからタスク生成
  npm run generate -- --team        # チームタスクを個別ファイルに出力
  npm run generate -- --my          # 自分のタスクのみ抽出
  npm run generate -- --ai          # AIでタスク判定して生成
  npm run generate -- --notify      # Chatworkに通知
`);
}

// メイン処理を実行
main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
