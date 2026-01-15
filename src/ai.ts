import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import type { Task } from './types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.claude.apiKey) {
      throw new Error('ANTHROPIC_API_KEY環境変数が設定されていません');
    }
    client = new Anthropic({ apiKey: config.claude.apiKey });
  }
  return client;
}

/**
 * AIでタスク候補を判定し、本当のタスクかどうかを判断
 */
export async function validateTasksWithAI(tasks: Task[]): Promise<Task[]> {
  if (!config.claude.apiKey) {
    console.log('⚠️ ANTHROPIC_API_KEYが未設定のため、AI判定をスキップ');
    return tasks;
  }

  if (tasks.length === 0) return [];

  const anthropic = getClient();
  const validatedTasks: Task[] = [];
  const batchSize = 10;

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const taskList = batch.map((t, idx) =>
      `${idx + 1}. 担当者: ${t.assignee}, 内容: ${t.content}, 期限: ${t.deadline || '未設定'}`
    ).join('\n');

    const prompt = `以下のリストは、チャットワークの会話ログから抽出された「タスク候補」です。
各項目が本当に「誰かがやるべきアクションアイテム（タスク）」かどうかを判定してください。

## タスク候補:
${taskList}

## 判定基準:
- タスク: 具体的なアクションがあり、担当者が明確で、実行可能なもの
- タスクではない: 単なる報告、共有情報、質問、完了した事項、一般的な会話

## 出力形式:
各タスク候補について、以下の形式でJSON配列として出力してください:
[
  { "index": 1, "isTask": true, "reason": "具体的なアクションがある" },
  { "index": 2, "isTask": false, "reason": "完了報告であり、これからやることではない" }
]

JSON配列のみを出力してください。`;

    try {
      const response = await anthropic.messages.create({
        model: config.claude.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') continue;

      // JSON部分を抽出
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('⚠️ AI応答からJSON抽出失敗、バッチをスキップ');
        validatedTasks.push(...batch);
        continue;
      }

      const results = JSON.parse(jsonMatch[0]) as Array<{
        index: number;
        isTask: boolean;
        reason: string;
      }>;

      for (const result of results) {
        if (result.isTask && result.index > 0 && result.index <= batch.length) {
          validatedTasks.push(batch[result.index - 1]);
        }
      }
    } catch (error) {
      console.error('⚠️ AI判定エラー:', error);
      // エラー時はそのままタスクとして扱う
      validatedTasks.push(...batch);
    }
  }

  return validatedTasks;
}

/**
 * 会話ログからタスクを抽出（AI支援）
 */
export async function extractTasksWithAI(
  conversationText: string,
  roomName: string,
  date: string
): Promise<Task[]> {
  if (!config.claude.apiKey) {
    console.log('⚠️ ANTHROPIC_API_KEYが未設定');
    return [];
  }

  const anthropic = getClient();

  const prompt = `以下はチャットワークの会話ログです。この中から「タスク」を抽出してください。

## 会話ログ:
${conversationText.slice(0, 8000)}

## チームメンバー:
${config.teamMembers.join(', ')}

## 抽出基準:
- 「〜してください」「〜をお願いします」「〜対応お願い」などの依頼
- 「〜までに」「〜日まで」などの期限付きアクション
- 明確な担当者と具体的なアクションがあるもの

## 出力形式:
JSON配列で出力してください:
[
  {
    "assignee": "担当者名",
    "content": "タスク内容",
    "deadline": "期限（あれば）"
  }
]

タスクがなければ空配列 [] を出力してください。
JSON配列のみを出力してください。`;

  try {
    const response = await anthropic.messages.create({
      model: config.claude.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const results = JSON.parse(jsonMatch[0]) as Array<{
      assignee: string;
      content: string;
      deadline?: string;
    }>;

    return results.map(r => ({
      assignee: r.assignee,
      content: r.content,
      deadline: r.deadline,
      room: roomName,
      sourceDate: date,
      type: 'ai_extracted' as const,
      status: 'pending' as const,
    }));
  } catch (error) {
    console.error('⚠️ AI抽出エラー:', error);
    return [];
  }
}
