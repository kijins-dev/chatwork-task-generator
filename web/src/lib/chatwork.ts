const API_BASE = 'https://api.chatwork.com/v2';
const TASK_ROOM_ID = '420216149';

interface TaskData {
  id: string;
  assignee: string;
  content: string;
  deadline?: string;
  status: string;
}

/**
 * Chatworkにメッセージを送信
 */
async function sendMessage(message: string): Promise<boolean> {
  const token = process.env.CHATWORK_API_TOKEN;

  if (!token) {
    console.log('CHATWORK_API_TOKEN未設定');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/rooms/${TASK_ROOM_ID}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': token,
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
 * タスク一覧を通知
 */
export async function notifyTaskList(tasks: TaskData[]): Promise<boolean> {
  if (tasks.length === 0) return true;

  // 担当者別にグループ化
  const byAssignee = new Map<string, TaskData[]>();
  for (const task of tasks) {
    const existing = byAssignee.get(task.assignee) || [];
    existing.push(task);
    byAssignee.set(task.assignee, existing);
  }

  const lines: string[] = [
    '[info][title]📋 本日のタスク一覧[/title]',
  ];

  for (const [assignee, assigneeTasks] of byAssignee) {
    lines.push(`[hr]`);
    lines.push(`👤 ${assignee}`);
    lines.push('');

    for (const task of assigneeTasks) {
      const deadline = task.deadline ? ` (${task.deadline})` : '';
      lines.push(`・${task.content}${deadline}`);
    }
    lines.push('');
  }

  lines.push('[/info]');

  return await sendMessage(lines.join('\n'));
}

/**
 * 個人にタスクを通知
 */
export async function notifyPersonalTasks(
  assignee: string,
  tasks: TaskData[],
  accountId?: string
): Promise<boolean> {
  if (tasks.length === 0) return true;

  const mention = accountId ? `[To:${accountId}]` : '';
  const lines: string[] = [
    `${mention}${assignee}さん`,
    '',
    '[info][title]📋 あなたのタスク[/title]',
  ];

  for (const task of tasks) {
    const deadline = task.deadline ? ` (${task.deadline})` : '';
    lines.push(`・${task.content}${deadline}`);
  }

  lines.push('[/info]');

  return await sendMessage(lines.join('\n'));
}

/**
 * タスク完了を通知
 */
export async function notifyTaskCompleted(
  task: TaskData,
  completedBy: string
): Promise<boolean> {
  const message = `[info]✅ タスク完了\n\n担当: ${task.assignee}\n内容: ${task.content}\n完了者: ${completedBy}[/info]`;
  return await sendMessage(message);
}
