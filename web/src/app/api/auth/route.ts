import { NextRequest, NextResponse } from 'next/server';
import { authenticateByPin } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin || pin.length !== 2) {
      return NextResponse.json(
        { error: '2桁の番号を入力してください' },
        { status: 400 }
      );
    }

    const user = await authenticateByPin(pin);

    if (!user) {
      return NextResponse.json(
        { error: '番号が正しくありません' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('認証エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
