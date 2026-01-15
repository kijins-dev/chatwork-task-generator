import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'タスクBot',
  description: 'チャットワークログからタスクを自動抽出・管理',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
