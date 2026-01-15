# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Obsidianに保存されたチャットワークログから、チーム全員のタスクを自動抽出するツール。将来的にWebアプリ（Next.js）とChatwork通知機能を追加予定。

## コマンド

```bash
npm run generate                  # 今日のログからタスク生成
npm run generate -- -d 2026-01-14 # 指定日のログ処理
npm run generate -- --all         # 全ログ処理
npm run generate -- --team        # チーム別出力
npm run generate -- --my          # 自分のタスクのみ
npm run build                     # TypeScriptビルド
```

## アーキテクチャ

```
src/
├── index.ts      # CLI エントリポイント（引数パース、メイン処理フロー）
├── config.ts     # 設定（Obsidianパス、チームメンバー、API設定）
├── types.ts      # 型定義（Task, RoomLog, DailyLog, Config）
├── parser.ts     # Markdownログのパース（ルーム分割、セクション抽出）
├── extractor.ts  # タスク抽出ロジック（担当者・内容・期限のパース）
└── writer.ts     # 出力処理（担当者別MD、チーム一覧、レポート生成）
```

### データフロー

1. `parser.ts`: Obsidianの`08_Chatworkログ/*.md`をパース → `DailyLog`
2. `extractor.ts`: 「次アクション」「要対応」セクションから`Task[]`抽出
3. `writer.ts`: `00_タスクBot/`にMarkdown出力

### タスク抽出パターン

- `**担当者**：タスク内容（期限）`
- `担当者さんがタスク内容（期限）`
- `担当者が・タスク内容・期限`

## 環境変数

```
CHATWORK_API_TOKEN  # Chatwork API認証
ANTHROPIC_API_KEY   # Claude API（タスク判定用、未実装）
```

## 要件定義

詳細は `docs/要件定義.md` を参照。Phase 2以降でWebアプリ（Next.js + Google Sheets）とChatwork通知を実装予定。
