import * as fs from 'fs';
import * as path from 'path';
import type { Task, AssigneeTasks } from './types.js';
import { getTaskOutputPath, config } from './config.js';

/**
 * ファイル名に使えない文字を除去
 */
function sanitizeFileName(name: string): string {
  // Windowsで使えない文字を除去: * / \ : ? " < > |
  return name.replace(/[*\/\\:?"<>|]/g, '').trim();
}

/**
 * 担当者別タスクをMarkdownファイルに書き込む
 */
export function writeAssigneeTasks(assigneeTasks: AssigneeTasks[]): void {
  const outputPath = getTaskOutputPath();

  // 出力フォルダが存在しない場合は作成
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  for (const { assignee, tasks } of assigneeTasks) {
    const sanitizedName = sanitizeFileName(assignee);
    if (!sanitizedName) continue; // 空の名前はスキップ

    const fileName = `${sanitizedName}_タスク.md`;
    const filePath = path.join(outputPath, fileName);

    const content = generateTaskMarkdown(assignee, tasks);
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`✅ ${assignee}のタスクを保存: ${fileName} (${tasks.length}件)`);
  }
}

/**
 * 全メンバーのタスク一覧を生成
 */
export function writeAllMembersTasks(assigneeTasks: AssigneeTasks[]): void {
  const outputPath = getTaskOutputPath();
  const filePath = path.join(outputPath, 'チームタスク一覧.md');

  const lines: string[] = [
    '# チームタスク一覧',
    '',
    `> 最終更新: ${new Date().toLocaleString('ja-JP')}`,
    '',
  ];

  for (const { assignee, tasks } of assigneeTasks) {
    lines.push(`## ${assignee} (${tasks.length}件)`);
    lines.push('');

    for (const task of tasks) {
      const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
      const deadline = task.deadline ? ` 📅 ${task.deadline}` : '';
      const room = ` 📌 ${task.room}`;
      lines.push(`- ${checkbox} ${task.content}${deadline}${room}`);
    }

    lines.push('');
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✅ チームタスク一覧を保存: チームタスク一覧.md`);
}

/**
 * 担当者別のMarkdownコンテンツを生成
 */
function generateTaskMarkdown(assignee: string, tasks: Task[]): string {
  const lines: string[] = [
    `# ${assignee}のタスク`,
    '',
    `> 最終更新: ${new Date().toLocaleString('ja-JP')}`,
    '',
  ];

  // タスクを種類別にグループ化
  const nextActions = tasks.filter(t => t.type === 'next_action');
  const requiredActions = tasks.filter(t => t.type === 'required_action');

  if (requiredActions.length > 0) {
    lines.push('## 🔴 要対応');
    lines.push('');
    for (const task of requiredActions) {
      lines.push(formatTask(task));
    }
    lines.push('');
  }

  if (nextActions.length > 0) {
    lines.push('## 📋 次アクション');
    lines.push('');
    for (const task of nextActions) {
      lines.push(formatTask(task));
    }
    lines.push('');
  }

  // ソース情報
  lines.push('---');
  lines.push('');
  lines.push('## ソース情報');
  lines.push('');

  const sources = [...new Set(tasks.map(t => `${t.sourceDate} - ${t.room}`))];
  for (const source of sources) {
    lines.push(`- ${source}`);
  }

  return lines.join('\n');
}

/**
 * タスクを Markdown フォーマットに変換
 */
function formatTask(task: Task): string {
  const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
  const deadline = task.deadline ? ` 📅 ${task.deadline}` : '';
  const room = ` (${task.room})`;

  return `- ${checkbox} ${task.content}${deadline}${room}`;
}

/**
 * 既存の未完了タスクファイルにマージして書き込む
 */
export function mergeWithExistingTasks(newTasks: Task[]): void {
  const outputPath = getTaskOutputPath();
  const filePath = path.join(outputPath, '未完了タスク.md');

  // 既存のタスクを読み込む
  let existingContent = '';
  if (fs.existsSync(filePath)) {
    existingContent = fs.readFileSync(filePath, 'utf-8');
  }

  // 既存のタスクをパース
  const existingTasks = parseExistingTasks(existingContent);

  // 新しいタスクを追加（重複チェック）
  const existingContents = new Set(existingTasks.map(t => t.content.toLowerCase()));

  const tasksToAdd = newTasks.filter(task =>
    !existingContents.has(task.content.toLowerCase())
  );

  if (tasksToAdd.length === 0) {
    console.log('ℹ️ 新しいタスクはありません');
    return;
  }

  // 新しいタスクを追加
  const now = new Date();
  const timestamp = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newLines: string[] = [];

  for (const task of tasksToAdd) {
    const line = `- [ ] ${task.content}（${timestamp}）`;
    newLines.push(line);
  }

  // ファイルに追記
  const updatedContent = existingContent.trim() + '\n' + newLines.join('\n') + '\n';
  fs.writeFileSync(filePath, updatedContent, 'utf-8');

  console.log(`✅ ${tasksToAdd.length}件の新しいタスクを追加しました`);
}

/**
 * 既存のタスクファイルをパース
 */
function parseExistingTasks(content: string): { content: string; completed: boolean }[] {
  const tasks: { content: string; completed: boolean }[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^- \[([ x])\] (.+)$/);
    if (match) {
      tasks.push({
        content: match[2].trim(),
        completed: match[1] === 'x',
      });
    }
  }

  return tasks;
}

/**
 * 日次レポートを生成
 */
export function writeDailyReport(tasks: Task[], date: string): void {
  const outputPath = getTaskOutputPath();
  const filePath = path.join(outputPath, `タスクレポート_${date}.md`);

  const lines: string[] = [
    `# タスクレポート (${date})`,
    '',
    `> 生成日時: ${new Date().toLocaleString('ja-JP')}`,
    '',
    '## 📊 サマリー',
    '',
    `- 合計タスク数: ${tasks.length}件`,
    `- 担当者数: ${new Set(tasks.map(t => t.assignee)).size}名`,
    '',
  ];

  // 担当者別の集計
  const byAssignee = new Map<string, number>();
  for (const task of tasks) {
    byAssignee.set(task.assignee, (byAssignee.get(task.assignee) || 0) + 1);
  }

  lines.push('## 👥 担当者別タスク数');
  lines.push('');

  for (const [assignee, count] of Array.from(byAssignee.entries()).sort((a, b) => b[1] - a[1])) {
    const isSelf = assignee === config.myName ? ' ⭐' : '';
    lines.push(`- ${assignee}: ${count}件${isSelf}`);
  }

  lines.push('');
  lines.push('## 📝 タスク詳細');
  lines.push('');

  for (const task of tasks) {
    const deadline = task.deadline ? ` 📅 ${task.deadline}` : '';
    const type = task.type === 'required_action' ? '🔴' : '📋';
    lines.push(`- ${type} **${task.assignee}**: ${task.content}${deadline}`);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✅ 日次レポートを保存: タスクレポート_${date}.md`);
}
