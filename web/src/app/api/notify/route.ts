import { NextResponse } from 'next/server';
import { getTasks, getMembers } from '@/lib/sheets';
import { notifyTaskList, notifyPersonalTasks } from '@/lib/chatwork';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, assignee } = body;

    // タスク一覧を取得
    const tasks = await getTasks();
    const pendingTasks = tasks.filter((t: any) => t.status !== '完了');

    if (type === 'all') {
      // 全タスクを通知
      const success = await notifyTaskList(pendingTasks);
      if (!success) {
        return NextResponse.json(
          { error: '通知の送信に失敗しました' },
          { status: 500 }
        );
      }
      return NextResponse.json({ message: `${pendingTasks.length}件のタスクを通知しました` });
    }

    if (type === 'personal' && assignee) {
      // 個人のタスクを通知
      const personalTasks = pendingTasks.filter((t: any) => t.assignee === assignee);

      // メンバー情報を取得してChatwork IDを探す
      const members = await getMembers();
      const member = members.find((m: any) => m.name === assignee);

      const success = await notifyPersonalTasks(
        assignee,
        personalTasks,
        member?.chatworkId
      );

      if (!success) {
        return NextResponse.json(
          { error: '通知の送信に失敗しました' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `${assignee}さんに${personalTasks.length}件のタスクを通知しました`,
      });
    }

    return NextResponse.json(
      { error: '無効なリクエスト' },
      { status: 400 }
    );
  } catch (error) {
    console.error('通知エラー:', error);
    return NextResponse.json(
      { error: '通知処理に失敗しました' },
      { status: 500 }
    );
  }
}
