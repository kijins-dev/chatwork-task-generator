import { config } from './config.js';
import type { Task, AssigneeTasks } from './types.js';

const API_BASE = 'https://api.chatwork.com/v2';

interface ChatworkMember {
  name: string;
  accountId?: string;
}

/**
 * Chatworkにメッセージを送信
 */
async function sendMessage(roomId: string, message: string): Promise<boolean> {
  if (!config.chatwork.apiToken) {
    console.log('⚠️ CHATWORK_API_TOKENが未設定');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': config.chatwork.apiToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `body=${encodeURIComponent(message)}`,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Chatwork API エラー:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Chatwork送信エラー:', error);
    return false;
  }
}

/**
 * タスク一覧をChatworkフォーマットに変換
 */
function formatTasksForChatwork(assigneeTasks: AssigneeTasks[]): string {
  const lines: string[] = [
    '[info][title]📋 本日のタスク一覧[/title]',
  ];

  for (const { assignee, tasks } of assigneeTasks) {
    if (tasks.length === 0) continue;

    lines.push(`[hr]`);
    lines.push(`👤 ${assignee}`);
    lines.push('');

    for (const task of tasks) {
      const deadline = task.deadline ? ` (${task.deadline})` : '';
      const room = task.room ? ` [${task.room}]` : '';
      lines.push(`・${task.content}${deadline}${room}`);
    }
    lines.push('');
  }

  lines.push('[/info]');

  return lines.join('\n');
}

/**
 * 個人へのタスク通知メッセージを生成
 */
function formatPersonalTaskNotification(
  assignee: string,
  tasks: Task[],
  accountId?: string
): string {
  const mention = accountId ? `[To:${accountId}]` : '';
  const lines: string[] = [
    `${mention}${assignee}さん`,
    '',
    '[info][title]📋 あなたのタスク[/title]',
  ];

  for (const task of tasks) {
    const deadline = task.deadline ? ` (${task.deadline})` : '';
    const priority = task.type === 'required_action' ? '🔴 ' : '';
    lines.push(`${priority}・${task.content}${deadline}`);
  }

  lines.push('[/info]');

  return lines.join('\n');
}

/**
 * 全員のタスクをまとめて通知
 */
export async function notifyAllTasks(assigneeTasks: AssigneeTasks[]): Promise<boolean> {
  const message = formatTasksForChatwork(assigneeTasks);
  console.log('📨 Chatwork通知を送信中...');

  const success = await sendMessage(config.chatwork.taskRoomId, message);

  if (success) {
    console.log('✓ タスク一覧を通知しました');
  }

  return success;
}

/**
 * 各担当者に個別通知（メンション付き）
 * memberMapは名前からChatworkアカウントIDへのマッピング
 */
export async function notifyIndividualTasks(
  assigneeTasks: AssigneeTasks[],
  memberMap: Map<string, string>
): Promise<void> {
  console.log('📨 個別通知を送信中...');

  for (const { assignee, tasks } of assigneeTasks) {
    if (tasks.length === 0) continue;

    const accountId = memberMap.get(assignee);
    const message = formatPersonalTaskNotification(assignee, tasks, accountId);

    const success = await sendMessage(config.chatwork.taskRoomId, message);

    if (success) {
      console.log(`  ✓ ${assignee}: ${tasks.length}件`);
    } else {
      console.log(`  ✗ ${assignee}: 送信失敗`);
    }

    // レート制限対策で少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * 期限が近いタスクのリマインダーを送信
 */
export async function sendDeadlineReminder(tasks: Task[]): Promise<boolean> {
  const today = new Date();
  const urgentTasks = tasks.filter(task => {
    if (!task.deadline) return false;

    // 期限パースを試みる
    const deadlinePatterns = [
      /(\d{1,2})\/(\d{1,2})/, // M/D
      /(\d{1,2})月(\d{1,2})日/, // M月D日
      /今日|本日/,
      /明日/,
      /今週/,
    ];

    for (const pattern of deadlinePatterns) {
      if (pattern.test(task.deadline)) {
        return true; // 期限が指定されていれば urgent と見なす
      }
    }

    return false;
  });

  if (urgentTasks.length === 0) {
    console.log('📅 期限が近いタスクはありません');
    return true;
  }

  const lines: string[] = [
    '[info][title]⚠️ 期限が近いタスク[/title]',
  ];

  for (const task of urgentTasks) {
    lines.push(`・${task.assignee}: ${task.content} (${task.deadline})`);
  }

  lines.push('[/info]');

  const message = lines.join('\n');
  return await sendMessage(config.chatwork.taskRoomId, message);
}

/**
 * デイリーサマリーを送信
 */
export async function sendDailySummary(
  assigneeTasks: AssigneeTasks[],
  date: string
): Promise<boolean> {
  const totalTasks = assigneeTasks.reduce((sum, at) => sum + at.tasks.length, 0);
  const memberCount = assigneeTasks.filter(at => at.tasks.length > 0).length;

  const lines: string[] = [
    `[info][title]📊 ${date} タスクサマリー[/title]`,
    '',
    `・合計タスク数: ${totalTasks}件`,
    `・担当者数: ${memberCount}名`,
    '',
  ];

  // 上位3名を表示
  const sorted = [...assigneeTasks].sort((a, b) => b.tasks.length - a.tasks.length);
  const top3 = sorted.slice(0, 3);

  if (top3.length > 0) {
    lines.push('📌 タスクが多い担当者:');
    for (const { assignee, tasks } of top3) {
      lines.push(`  ${assignee}: ${tasks.length}件`);
    }
  }

  lines.push('', '[/info]');

  const message = lines.join('\n');
  return await sendMessage(config.chatwork.taskRoomId, message);
}
