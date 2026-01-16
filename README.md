# タスクBot

Obsidianに保存されたチャットワークログから、チーム全員のタスクを自動抽出し、Webアプリで管理・Chatworkで通知するツール。

## システム構成

```
GitHub               タスク抽出        Google
obsidian-chatwork-  (Claude AI)  →  スプレッドシート
logs                      ↓              ↓
                       Chatwork      Webアプリ
                        通知        (Next.js)
```

## 機能

- **タスク抽出**: チャットワークログの「次アクション」「要対応」からタスクを自動抽出
- **AI判定**: Claude APIで発言内容とタスクを判別
- **Google Sheets保存**: 抽出したタスクをスプレッドシートに保存
- **Webアプリ**: チーム全員がタスクを確認・完了管理
- **Chatwork通知**: 毎朝10時に担当者へメンション付き通知（実装予定）

## クイックスタート

```bash
# インストール
npm install

# ビルド
npm run build

# タスク生成（今日のログ）
node dist/index.js

# 特定の日付
node dist/index.js -d 2026-01-14

# 全ログ処理
node dist/index.js --all

# Chatwork通知付き
node dist/index.js --notify
```

## コマンドオプション

| オプション | 説明 |
|-----------|------|
| `-t, --today` | 今日のログのみ処理（デフォルト） |
| `-a, --all` | すべてのログを処理 |
| `-d, --date` | 指定日付のログを処理 |
| `--notify` | Chatwork通知を送信 |

## 環境変数

```env
OBSIDIAN_PATH=        # Chatworkログのパス（GitHub Actions: ../logs）
ANTHROPIC_API_KEY=    # Claude API認証
SPREADSHEET_ID=       # Google スプレッドシートID
GOOGLE_SERVICE_ACCOUNT_EMAIL=  # Google サービスアカウント
GOOGLE_PRIVATE_KEY=   # Google 秘密鍵
CHATWORK_API_TOKEN=   # Chatwork API認証
```

## 開発フェーズ

- [x] **Phase 1**: ログパース・タスク抽出・Google Sheets保存
- [x] **Phase 2**: Webアプリ（Next.js + Google Sheets）
- [ ] **Phase 3**: GitHub Actions自動実行（毎朝10時）
- [ ] **Phase 4**: Chatwork通知

## 技術スタック

| 領域 | 技術 |
|------|------|
| CLI | TypeScript, Node.js |
| Webアプリ | Next.js 15, React 19, Tailwind CSS |
| データ | Google スプレッドシート |
| AI | Claude API |
| 通知 | Chatwork API |
| CI/CD | GitHub Actions |

## 関連リポジトリ

- [obsidian-chatwork-logs](https://github.com/kijins-dev/obsidian-chatwork-logs) - Chatworkログ保存（n8n経由）

## ドキュメント

- [要件定義](docs/要件定義.md)
