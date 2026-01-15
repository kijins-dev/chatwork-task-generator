import { NextRequest, NextResponse } from 'next/server';
import { completeTask } from '@/lib/sheets';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.status === 'completed') {
      await completeTask(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: '不正なリクエストです' },
      { status: 400 }
    );
  } catch (error) {
    console.error('タスク更新エラー:', error);
    return NextResponse.json(
      { error: 'タスクの更新に失敗しました' },
      { status: 500 }
    );
  }
}
