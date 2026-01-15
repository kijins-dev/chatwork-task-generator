import { NextResponse } from 'next/server';
import { getTasks, addTask } from '@/lib/sheets';

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('タスク取得エラー:', error);
    return NextResponse.json(
      { error: 'タスクの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, assignee, deadline, room, sourceDate } = body;

    if (!content || !assignee) {
      return NextResponse.json(
        { error: 'タスク内容と担当者は必須です' },
        { status: 400 }
      );
    }

    const id = await addTask({
      content,
      assignee,
      deadline,
      room: room || '',
      sourceDate: sourceDate || new Date().toISOString().split('T')[0],
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error('タスク追加エラー:', error);
    return NextResponse.json(
      { error: 'タスクの追加に失敗しました' },
      { status: 500 }
    );
  }
}
