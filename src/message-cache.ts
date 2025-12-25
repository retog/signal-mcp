/**
 * Simple message cache for tracking recent conversations
 * Stores messages in a SQLite database to persist between restarts
 */

import type { MessageResult } from "./types.ts";

export interface RecentChat {
  contact: string;
  contactName?: string;
  isGroup: boolean;
  groupName?: string;
  lastMessageTimestamp: number;
  lastMessageBody?: string;
  unreadCount: number;
}

export class MessageCache {
  private dbPath: string;
  private db: any;

  constructor(dbPath: string = "./signal-mcp-cache.db") {
    this.dbPath = dbPath;
    this.initDatabase();
  }

  /**
   * Initialize the SQLite database
   */
  private async initDatabase() {
    // Using Deno's SQLite library
    const { DB } = await import("https://deno.land/x/sqlite@v3.8/mod.ts");
    
    this.db = new DB(this.dbPath);

    // Create messages table
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        sender_name TEXT,
        timestamp INTEGER NOT NULL,
        body TEXT,
        is_group INTEGER DEFAULT 0,
        group_id TEXT,
        read INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create index for faster queries
    this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
      ON messages(timestamp DESC)
    `);
    
    this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender 
      ON messages(sender, timestamp DESC)
    `);
  }

  /**
   * Store a received message
   */
  storeMessage(message: MessageResult): void {
    if (!this.db) return;

    try {
      this.db.query(
        `INSERT INTO messages (sender, sender_name, timestamp, body, is_group, group_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          message.sender || "unknown",
          message.senderName || null,
          message.timestamp,
          message.body || null,
          message.isGroup ? 1 : 0,
          message.groupId || null,
        ]
      );
    } catch (error) {
      console.error("Failed to store message:", error);
    }
  }

  /**
   * Store multiple messages
   */
  storeMessages(messages: MessageResult[]): void {
    for (const message of messages) {
      this.storeMessage(message);
    }
  }

  /**
   * Get recent chats sorted by last message timestamp
   */
  getRecentChats(limit: number = 20): RecentChat[] {
    if (!this.db) return [];

    try {
      // Get the most recent message for each sender
      const results = this.db.query(`
        WITH latest_messages AS (
          SELECT 
            sender,
            sender_name,
            MAX(timestamp) as last_timestamp,
            is_group,
            group_id,
            (SELECT body FROM messages m2 
             WHERE m2.sender = m1.sender 
             ORDER BY timestamp DESC LIMIT 1) as last_body,
            COUNT(*) FILTER (WHERE read = 0) as unread_count
          FROM messages m1
          GROUP BY sender
          ORDER BY last_timestamp DESC
          LIMIT ?
        )
        SELECT * FROM latest_messages
      `, [limit]);

      return results.map((row: any[]) => ({
        contact: row[0],
        contactName: row[1] || undefined,
        lastMessageTimestamp: row[2],
        isGroup: row[3] === 1,
        groupName: row[4] || undefined,
        lastMessageBody: row[5] || undefined,
        unreadCount: row[6] || 0,
      }));
    } catch (error) {
      console.error("Failed to get recent chats:", error);
      return [];
    }
  }

  /**
   * Mark messages from a sender as read
   */
  markAsRead(sender: string): void {
    if (!this.db) return;

    try {
      this.db.query(
        `UPDATE messages SET read = 1 WHERE sender = ? AND read = 0`,
        [sender]
      );
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  }

  /**
   * Search messages by content
   */
  searchMessages(query: string, sender?: string, limit: number = 50): MessageResult[] {
    if (!this.db) return [];

    try {
      let sql = `
        SELECT sender, sender_name, timestamp, body, is_group, group_id
        FROM messages
        WHERE body LIKE ?
      `;
      const params: any[] = [`%${query}%`];

      if (sender) {
        sql += ` AND (sender = ? OR sender_name LIKE ?)`;
        params.push(sender, `%${sender}%`);
      }

      sql += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const results = this.db.query(sql, params);

      return results.map((row: any[]) => ({
        sender: row[0],
        senderName: row[1] || undefined,
        timestamp: row[2],
        body: row[3] || undefined,
        isGroup: row[4] === 1,
        groupId: row[5] || undefined,
      }));
    } catch (error) {
      console.error("Failed to search messages:", error);
      return [];
    }
  }

  /**
   * Clean up old messages (keep last 30 days by default)
   */
  cleanup(daysToKeep: number = 30): void {
    if (!this.db) return;

    try {
      const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      this.db.query(
        `DELETE FROM messages WHERE timestamp < ?`,
        [cutoffTimestamp]
      );
    } catch (error) {
      console.error("Failed to cleanup old messages:", error);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
