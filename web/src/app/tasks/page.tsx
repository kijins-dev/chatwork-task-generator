'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  assignee: string;
  content: string;
  deadline: string;
  status: string;
  createdAt: string;
  room: string;
  priority: string;
}

interface User {
  name: string;
  pin: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [notifying, setNotifying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // ユーザー情報を取得
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(userData));

    // タスク一覧を取得
    fetchTasks();
  }, [router]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);

      // 担当者リストを抽出
      const uniqueAssignees = [...new Set(data.tasks?.map((t: Task) => t.assignee) || [])];
      setAssignees(uniqueAssignees as string[]);
    } catch (error) {
      console.error('タスク取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (res.ok) {
        // タスクをリストから削除
        setTasks(tasks.filter((t) => t.id !== taskId));
      }
    } catch (error) {
      console.error('完了処理エラー:', error);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    router.push('/');
  };

  const handleNotify = async (type: 'all' | 'personal') => {
    setNotifying(true);
    try {
      const body: any = { type };
      if (type === 'personal' && filter !== 'all') {
        body.assignee = filter;
      }
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || '通知を送信しました');
      } else {
        alert(data.error || '通知の送信に失敗しました');
      }
    } catch (error) {
      console.error('通知エラー:', error);
      alert('通知の送信に失敗しました');
    } finally {
      setNotifying(false);
    }
  };

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.assignee === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">タスクBot</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* フィルター */}
        <div className="mb-6 flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="all">全員</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            更新
          </button>
          <button
            onClick={() => handleNotify('all')}
            disabled={notifying}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {notifying ? '送信中...' : '📢 全員に通知'}
          </button>
          {filter !== 'all' && (
            <button
              onClick={() => handleNotify('personal')}
              disabled={notifying}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {notifying ? '送信中...' : `📨 ${filter}さんに通知`}
            </button>
          )}
        </div>

        {/* タスク一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">
              📋 未完了タスク ({filteredTasks.length}件)
            </h2>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              タスクはありません
            </div>
          ) : (
            <ul className="divide-y">
              {filteredTasks.map((task) => (
                <li key={task.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="mt-1 w-5 h-5 border-2 rounded border-gray-300 hover:border-blue-500 hover:bg-blue-50 flex-shrink-0"
                      title="完了にする"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900">{task.content}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-500">
                        <span>👤 {task.assignee}</span>
                        {task.deadline && <span>📅 {task.deadline}</span>}
                        <span>📌 {task.room}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
