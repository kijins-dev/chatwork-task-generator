import Anthropic from '@anthropic-ai/sdk';
import type { Task, DailyLog } from './types.js';
import { getMemberNames, getMemberIdMap, getExcludedRooms } from './sheets.js';

const client = new Anthropic();

/**
 * AIでログからタスクを抽出（メンバー限定）
 */
export async function extractTasksWithAI(logs: DailyLog[]): Promise<Task[]> {
  // メンバーリスト、IDマッピング、除外ルームを取得
  const members = await getMemberNames();
  const idMap = await getMemberIdMap();
  const excludedRooms = await getExcludedRooms();
  console.log(`📋 対象メンバー: ${members.join(', ')}`);

  const allTasks: Task[] = [];

  for (const log of logs) {
    for (const room of log.rooms) {
      // 除外ルームをスキップ（部分一致）
      if (excludedRooms.some(ex => room.name.includes(ex) || ex.includes(room.name))) {
        continue;
      }

      // 次アクションと要対応を結合
      const actionText = [
        '## 次アクション',
        ...room.nextActions,
        '',
        '## 要対応',
        ...room.requiredActions,
      ].join('\n');

      // 空なら スキップ
      if (room.nextActions.length === 0 && room.requiredActions.length === 0) {
        continue;
      }

      const tasks = await extractFromSection(actionText, members, idMap, room.name, log.date);
      allTasks.push(...tasks);
    }
  }

  // 重複除去
  return deduplicateTasks(allTasks);
}

/**
 * セクションからAIでタスク抽出
 */
async function extractFromSection(
  text: string,
  members: string[],
  idMap: Map<string, string>,
  roomName: string,
  date: string
): Promise<Task[]> {
  if (!text.trim() || text.length < 10) return [];

  // テキスト内のチャットワークIDを名前に変換
  let processedText = text;
  for (const [id, name] of idMap) {
    // 「※08016254595」や「（※08016254595）」のパターンを置換
    processedText = processedText.replace(new RegExp(`※${id}`, 'g'), `（${name}）`);
    processedText = processedText.replace(new RegExp(`\\(${id}\\)`, 'g'), `（${name}）`);
  }

  const prompt = `以下はチャットワークの会話ログから抽出された「次アクション」「要対応」セクションです。

## 対象メンバー一覧
${members.join(', ')}

## ログ内容
${processedText.slice(0, 4000)}

## ルール
1. ログに記載された担当者が対象メンバーの場合のみ抽出
2. 担当者名はログに記載された通りに出力（推測・変更しない）
3. 対象メンバー以外の人のタスクはスキップ
4. 担当者不明のタスクもスキップ

## スキップ例（対象外の人）
- 伊藤 蒼星、ピアラ 町田幸司、白河善貴、塩津 直輝、立津 雅貴、福島 正隆、小川 桃佳 など

## 出力形式（JSON配列のみ）
[{"assignee": "担当者名", "content": "タスク内容", "deadline": "期限"}]

該当なしなら [] を返す。`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    // JSON抽出
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const results = JSON.parse(jsonMatch[0]) as Array<{
      assignee: string;
      content: string;
      deadline?: string;
    }>;

    // メンバーリストで再フィルタ（AIが間違えた場合の保険）
    return results
      .map(r => {
        // 担当者名にIDが含まれている場合、名前に変換
        let assignee = r.assignee || '';
        for (const [id, name] of idMap) {
          if (assignee.includes(id)) {
            assignee = name;
            break;
          }
        }
        return { ...r, assignee };
      })
      // 担当者とタスク内容が両方あるものだけ
      .filter(r => r.assignee && r.content && r.content.trim().length > 0)
      // メンバーリストに含まれる担当者のみ
      .filter(r => isMemberMatch(r.assignee, members))
      .map(r => ({
        assignee: normalizeToMember(r.assignee, members),
        content: r.content.trim(),
        deadline: r.deadline,
        room: roomName,
        sourceDate: date,
        type: 'ai_extracted' as const,
        status: 'pending' as const,
      }));
  } catch (error) {
    console.error(`⚠️ AI抽出エラー (${roomName}):`, error);
    return [];
  }
}

/**
 * 担当者名がメンバーリストに含まれるかチェック（姓で判定）
 */
function isMemberMatch(assignee: string | null | undefined, members: string[]): boolean {
  if (!assignee) return false;
  const normalized = assignee.replace(/\s+/g, '');

  for (const member of members) {
    const memberNormalized = member.replace(/\s+/g, '');

    // 完全一致
    if (normalized === memberNormalized) return true;

    // 姓（最初の2-3文字）で一致判定
    const assigneeSurname = normalized.slice(0, 3);
    const memberSurname = memberNormalized.slice(0, 3);
    if (assigneeSurname === memberSurname && assigneeSurname.length >= 2) return true;

    // 部分一致（名前全体が含まれる）
    if (normalized.includes(memberNormalized) || memberNormalized.includes(normalized)) return true;
  }

  return false;
}

/**
 * 担当者名をメンバーリストの名前に正規化
 */
function normalizeToMember(name: string, members: string[]): string {
  const normalized = name.replace(/\s+/g, '');
  const match = members.find(m => {
    const memberNormalized = m.replace(/\s+/g, '');
    // 完全一致
    if (normalized === memberNormalized) return true;
    // 姓で一致
    const assigneeSurname = normalized.slice(0, 3);
    const memberSurname = memberNormalized.slice(0, 3);
    if (assigneeSurname === memberSurname && assigneeSurname.length >= 2) return true;
    // 部分一致
    return normalized.includes(memberNormalized) || memberNormalized.includes(normalized);
  });
  return match || name;
}

/**
 * 重複除去
 */
function deduplicateTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter(t => {
    const key = `${t.assignee}|${t.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
