# タスクBot

Obsidianに保存されたチャットワークログから、チーム全員のタスクを自動抽出し、Webアプリで管理・Chatworkで通知するツール。

## システム構成

```
Obsidian          タスク抽出        Google
Chatworkログ  →  (Claude AI)  →  スプレッドシート
                                      ↓
                    ┌─────────────────┼─────────────┐
                    ↓                 ↓             ↓
                 Webアプリ        Chatwork      Obsidian
                (Next.js)         通知         バックアップ
```

## 機能

- **タスク抽出**: チャットワークログの「次アクション」「要対応」からタスクを自動抽出
- **AI判定**: Claude APIで発言内容とタスクを判別（実装予定）
- **Webアプリ**: チーム全員がタスクを確認・完了管理（実装予定）
- **Chatwork通知**: 毎朝10時に担当者へメンション付き通知（実装予定）

## クイックスタート

```bash
# インストール
npm install

# タスク生成（今日のログ）
npm run generate

# 特定の日付
npm run generate -- -d 2026-01-14

# 全ログ処理
npm run generate -- --all
```

## コマンドオプション

| オプション | 説明 |
|-----------|------|
| `-t, --today` | 今日のログのみ処理（デフォルト） |
| `-a, --all` | すべてのログを処理 |
| `-d, --date` | 指定日付のログを処理 |
| `--team` | チームメンバー別にファイル出力 |
| `--my` | 自分のタスクのみ抽出 |
| `--report` | 日次レポートのみ生成 |

## 出力ファイル

`Obsidian/00_タスクBot/` に以下を出力：

- `〇〇_タスク.md` - 担当者別タスク一覧
- `チームタスク一覧.md` - 全メンバーのタスク集約
- `タスクレポート_YYYY-MM-DD.md` - 日次サマリー

## 設定

`src/config.ts` で以下を設定：

- `obsidianPath` - Obsidian Vaultのパス
- `myName` - 自分の名前
- `teamMembers` - チームメンバーリスト

## 環境変数

```
CHATWORK_API_TOKEN  # Chatwork API認証
ANTHROPIC_API_KEY   # Claude API（タスク判定用）
```

## 開発フェーズ

- [x] **Phase 1**: ログパース・タスク抽出
- [ ] **Phase 2**: Webアプリ（Next.js + Google Sheets）
- [ ] **Phase 3**: AI判定 + Chatwork通知
- [ ] **Phase 4**: 自動化（毎朝10時実行）

## 技術スタック

| 領域 | 技術 |
|------|------|
| CLI | TypeScript, Node.js |
| Webアプリ | Next.js 15, React 19, Tailwind CSS |
| データ | Google スプレッドシート |
| AI | Claude API |
| 通知 | Chatwork API |

## ドキュメント

- [要件定義](docs/要件定義.md)
