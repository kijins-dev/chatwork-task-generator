import type { Task, DailyLog, RoomLog, AssigneeTasks } from './types.js';
import { config } from './config.js';

/**
 * 日次ログからタスクを抽出
 */
export function extractTasksFromLog(log: DailyLog): Task[] {
  const tasks: Task[] = [];

  for (const room of log.rooms) {
    // 次アクションからタスクを抽出
    for (const action of room.nextActions) {
      const parsed = parseActionLine(action);
      if (parsed) {
        tasks.push({
          assignee: normalizeAssigneeName(parsed.assignee),
          content: parsed.content,
          deadline: parsed.deadline,
          room: room.name,
          sourceDate: log.date,
          type: 'next_action',
          status: 'pending',
        });
      }
    }

    // 要対応からタスクを抽出（担当者が明示されていない場合は「自分」として扱う）
    for (const action of room.requiredActions) {
      const parsed = parseActionLine(action);
      if (parsed) {
        tasks.push({
          assignee: normalizeAssigneeName(parsed.assignee),
          content: parsed.content,
          deadline: parsed.deadline,
          room: room.name,
          sourceDate: log.date,
          type: 'required_action',
          status: 'pending',
        });
      } else {
        // 担当者が抽出できない場合は自分のタスクとして扱う
        tasks.push({
          assignee: config.myName,
          content: action,
          room: room.name,
          sourceDate: log.date,
          type: 'required_action',
          status: 'pending',
        });
      }
    }
  }

  return tasks;
}

/**
 * アクション行をパースして担当者・内容・期限を抽出
 */
function parseActionLine(line: string): { assignee: string; content: string; deadline?: string } | null {
  // プレースホルダーをスキップ
  if (line.includes('誰が・何を・いつまでに')) return null;
  if (line.includes('期限付きアクションは記載されていない')) return null;
  if (line.includes('承認が完了し')) return null;

  // パターン1: **担当者**：タスク内容（期限）
  const pattern1 = /^\*\*(.+?)\*\*[：:]\s*(.+?)(?:（(.+?)）)?$/;
  const match1 = line.match(pattern1);
  if (match1) {
    const assignee = match1[1].trim();
    if (isValidAssigneeName(assignee)) {
      return {
        assignee,
        content: match1[2].trim(),
        deadline: match1[3]?.trim(),
      };
    }
  }

  // パターン2: 担当者さんがタスク内容（期限）
  const pattern2a = /^(.+?)さんが(.+?)(?:（(.+?)）)?$/;
  const match2a = line.match(pattern2a);
  if (match2a) {
    const potentialAssignee = match2a[1].trim();
    if (isValidAssigneeName(potentialAssignee)) {
      return {
        assignee: potentialAssignee,
        content: match2a[2].trim(),
        deadline: match2a[3]?.trim(),
      };
    }
  }

  // パターン3: 担当者が・タスク内容・期限
  const pattern3 = /^(.+?)が[・](.+?)[・](.+?)$/;
  const match3 = line.match(pattern3);
  if (match3) {
    const potentialAssignee = match3[1].trim().replace(/@.*$/, '');
    if (isValidAssigneeName(potentialAssignee)) {
      return {
        assignee: potentialAssignee,
        content: match3[2].trim(),
        deadline: match3[3]?.trim(),
      };
    }
  }

  // パターン4: 担当者：タスク内容（期限）
  const pattern4 = /^(.+?)[：:]\s*(.+?)(?:（(.+?)）)?$/;
  const match4 = line.match(pattern4);
  if (match4) {
    const potentialAssignee = match4[1].trim();
    if (isValidAssigneeName(potentialAssignee)) {
      return {
        assignee: potentialAssignee,
        content: match4[2].trim(),
        deadline: match4[3]?.trim(),
      };
    }
  }

  return null;
}

/**
 * 有効な担当者名かどうかを判定
 */
function isValidAssigneeName(name: string): boolean {
  // 空や短すぎる名前は除外
  if (!name || name.length < 2) return false;

  // 長すぎる名前は除外（通常の人名は10文字以内）
  if (name.length > 15) return false;

  // 数字で始まる名前は除外
  if (/^\d/.test(name)) return false;

  // 特定のキーワードを含む場合は除外
  const invalidPatterns = [
    '決定事項', '発言者', '内容', '時系列', 'いつまでに', '何を', '誰が',
    'スコープ', '体制', '条件', '募集', '契約', '金額', '時期', '期限',
    'http', 'URL', '※', '【', '】', '（システム', 'インフォメーション',
  ];
  for (const pattern of invalidPatterns) {
    if (name.includes(pattern)) return false;
  }

  // Markdownの記号が残っている場合は除外
  if (name.includes('**') || name.includes('__')) return false;

  // 日本語名として妥当かチェック（漢字・ひらがな・カタカナを含む）
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  if (japanesePattern.test(name)) return true;

  // チームメンバーリストに含まれているかチェック
  return config.teamMembers.some(member =>
    member.includes(name) || name.includes(member)
  );
}

/**
 * 担当者名を正規化（表記ゆれを統一）
 */
function normalizeAssigneeName(name: string): string {
  // Markdownの太字マーカーを除去
  let normalized = name.replace(/\*\*/g, '').trim();

  // 「@」や特殊文字を除去
  normalized = normalized.replace(/@.*$/, '').trim();

  // 「（自分）」を実名に置換
  if (normalized.includes('自分')) {
    normalized = config.myName;
  }

  // スペースを削除
  normalized = normalized.replace(/\s+/g, '');

  // 無効な担当者名をフィルタ（数字で始まる、特殊パターンなど）
  if (!isValidAssigneeName(normalized)) {
    return config.myName; // 不明な場合は自分のタスクとして扱う
  }

  // チームメンバーリストから正式名を探す
  const matchedMember = config.teamMembers.find(member => {
    const memberNormalized = member.replace(/\s+/g, '');
    return memberNormalized.includes(normalized) || normalized.includes(memberNormalized);
  });

  return matchedMember || normalized;
}

/**
 * タスクを担当者別にグループ化
 */
export function groupTasksByAssignee(tasks: Task[]): AssigneeTasks[] {
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    const existing = grouped.get(task.assignee) || [];
    existing.push(task);
    grouped.set(task.assignee, existing);
  }

  // Map を配列に変換し、担当者名でソート
  return Array.from(grouped.entries())
    .map(([assignee, tasks]) => ({ assignee, tasks }))
    .sort((a, b) => {
      // 自分を最初に
      if (a.assignee === config.myName) return -1;
      if (b.assignee === config.myName) return 1;
      return a.assignee.localeCompare(b.assignee, 'ja');
    });
}

/**
 * 複数の日次ログからタスクを抽出してマージ
 */
export function extractTasksFromLogs(logs: DailyLog[]): Task[] {
  const allTasks: Task[] = [];

  for (const log of logs) {
    const tasks = extractTasksFromLog(log);
    allTasks.push(...tasks);
  }

  // 重複を除去（同じ担当者・同じ内容のタスク）
  return deduplicateTasks(allTasks);
}

/**
 * タスクの重複を除去
 */
function deduplicateTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  const unique: Task[] = [];

  for (const task of tasks) {
    const key = `${task.assignee}|${task.content}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(task);
    }
  }

  return unique;
}

/**
 * 自分のタスクのみをフィルタ
 */
export function filterMyTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => task.assignee === config.myName);
}

/**
 * チームメンバーのタスクのみをフィルタ
 */
export function filterTeamTasks(tasks: Task[]): Task[] {
  return tasks.filter(task =>
    config.teamMembers.some(member =>
      task.assignee.includes(member) || member.includes(task.assignee)
    )
  );
}
