import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

export interface ReplyLogRecord {
  id: number;
  event_id: string;
  reply_text: string;
  timestamp: string;
}

export class DatabaseService {
  private db: DatabaseSync | null = null;

  public initialize(dbPath: string = config.databasePath): void {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reply_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        reply_text TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reply_event ON reply_logs(event_id);
    `);
  }

  public insertReply(eventId: string, replyText: string, timestamp: string): void {
    if (!this.db) {
      this.initialize();
    }
    const stmt = this.db!.prepare(
      'INSERT INTO reply_logs (event_id, reply_text, timestamp) VALUES (?, ?, ?)'
    );
    stmt.run(eventId, replyText, timestamp);
  }

  public getRepliesByEventId(eventId: string): ReplyLogRecord[] {
    if (!this.db) {
      this.initialize();
    }
    const stmt = this.db!.prepare(
      'SELECT id, event_id, reply_text, timestamp FROM reply_logs WHERE event_id = ? ORDER BY id DESC'
    );
    return stmt.all(eventId) as unknown as ReplyLogRecord[];
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const dbService = new DatabaseService();
