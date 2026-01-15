/**
 * タスクの型定義
 */
export interface Task {
  /** 担当者名 */
  assignee: string;
  /** タスク内容 */
  content: string;
  /** 期限（あれば） */
  deadline?: string;
  /** 抽出元のルーム名 */
  room: string;
  /** 抽出元の日付 */
  sourceDate: string;
  /** タスクの種類 */
  type: 'next_action' | 'required_action';
  /** ステータス */
  status: 'pending' | 'completed';
}

/**
 * ルームごとのログ情報
 */
export interface RoomLog {
  /** ルーム名 */
  name: string;
  /** 次アクションのリスト */
  nextActions: string[];
  /** 要対応のリスト */
  requiredActions: string[];
  /** 自分への関係 */
  selfRelation?: {
    hasMention: boolean;
    hasMessage: boolean;
  };
}

/**
 * 日次ログファイル
 */
export interface DailyLog {
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** ルームごとのログ */
  rooms: RoomLog[];
}

/**
 * 担当者別タスク
 */
export interface AssigneeTasks {
  /** 担当者名 */
  assignee: string;
  /** タスクリスト */
  tasks: Task[];
}

/**
 * 設定
 */
export interface Config {
  /** Obsidian vaultのパス */
  obsidianPath: string;
  /** チャットワークログのフォルダ名 */
  chatworkLogFolder: string;
  /** タスク出力先フォルダ名 */
  taskOutputFolder: string;
  /** 自分の名前（タスクの「自分」を置換するため） */
  myName: string;
  /** チームメンバーのリスト（タスク抽出対象） */
  teamMembers: string[];
}
