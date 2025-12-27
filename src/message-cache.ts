/**
 * Simple message cache for tracking recent conversations
 * Stores messages in a JSON file to persist between restarts
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

interface CachedMessage {
  sender: string;
  senderName?: string;
  timestamp: number;
  body?: string;
  isGroup: boolean;
  groupId?: string;
  read: boolean;
}

export class MessageCache {
  private cachePath: string;
  private messages: CachedMessage[] = [];
  private maxMessages: number = 10000; // Keep last 10k messages

  constructor(cachePath: string = "./signal-mcp-cache.json") {
    this.cachePath = cachePath;
    this.loadCache();
  }

  /**
   * Load cache from file
   */
  private loadCache(): void {
    try {
      const data = Deno.readTextFileSync(this.cachePath);
      const parsed = JSON.parse(data);
      this.messages = parsed.messages || [];
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.messages = [];
    }
  }

  /**
   * Save cache to file
   */
  private saveCache(): void {
    try {
      const data = JSON.stringify({ messages: this.messages }, null, 2);
      Deno.writeTextFileSync(this.cachePath, data);
    } catch (error) {
      console.error("Failed to save cache:", error);
    }
  }

  /**
   * Store a received message
   */
  storeMessage(message: MessageResult): void {
    try {
      // Check if message already exists (by timestamp and sender)
      const exists = this.messages.some(
        m => m.timestamp === message.timestamp && m.sender === message.sender
      );
      
      if (exists) return;

      this.messages.push({
        sender: message.sender || "unknown",
        senderName: message.senderName,
        timestamp: message.timestamp,
        body: message.body,
        isGroup: message.isGroup || false,
        groupId: message.groupId,
        read: false,
      });

      // Keep only the most recent messages
      if (this.messages.length > this.maxMessages) {
        this.messages.sort((a, b) => b.timestamp - a.timestamp);
        this.messages = this.messages.slice(0, this.maxMessages);
      }

      this.saveCache();
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
    try {
      // Group messages by sender
      const chatMap = new Map<string, CachedMessage[]>();
      
      for (const msg of this.messages) {
        if (!chatMap.has(msg.sender)) {
          chatMap.set(msg.sender, []);
        }
        chatMap.get(msg.sender)!.push(msg);
      }

      // Create chat summaries
      const chats: RecentChat[] = [];
      
      for (const [sender, messages] of chatMap.entries()) {
        // Sort messages by timestamp (newest first)
        messages.sort((a, b) => b.timestamp - a.timestamp);
        const lastMessage = messages[0];
        const unreadCount = messages.filter(m => !m.read).length;

        chats.push({
          contact: sender,
          contactName: lastMessage.senderName,
          lastMessageTimestamp: lastMessage.timestamp,
          isGroup: lastMessage.isGroup,
          groupName: lastMessage.isGroup ? lastMessage.senderName : undefined,
          lastMessageBody: lastMessage.body,
          unreadCount,
        });
      }

      // Sort by last message timestamp
      chats.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

      return chats.slice(0, limit);
    } catch (error) {
      console.error("Failed to get recent chats:", error);
      return [];
    }
  }

  /**
   * Mark messages from a sender as read
   */
  markAsRead(sender: string): void {
    try {
      let modified = false;
      for (const msg of this.messages) {
        if (msg.sender === sender && !msg.read) {
          msg.read = true;
          modified = true;
        }
      }
      if (modified) {
        this.saveCache();
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  }

  /**
   * Search messages by content
   */
  searchMessages(query: string, sender?: string, limit: number = 50): MessageResult[] {
    try {
      const lowerQuery = query.toLowerCase();
      
      let filtered = this.messages.filter(msg => {
        const bodyMatch = msg.body?.toLowerCase().includes(lowerQuery);
        const senderMatch = msg.sender?.toLowerCase().includes(lowerQuery);
        const nameMatch = msg.senderName?.toLowerCase().includes(lowerQuery);
        
        const textMatch = bodyMatch || senderMatch || nameMatch;
        
        if (!textMatch) return false;
        
        if (sender) {
          const senderLower = sender.toLowerCase();
          return msg.sender?.toLowerCase().includes(senderLower) ||
                 msg.senderName?.toLowerCase().includes(senderLower);
        }
        
        return true;
      });

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => b.timestamp - a.timestamp);
      
      // Convert to MessageResult format
      return filtered.slice(0, limit).map(msg => ({
        sender: msg.sender,
        senderName: msg.senderName,
        timestamp: msg.timestamp,
        body: msg.body,
        isGroup: msg.isGroup,
        groupId: msg.groupId,
      }));
    } catch (error) {
      console.error("Failed to search messages:", error);
      return [];
    }
  }

  /**
   * Get the most recent messages (no search, just latest)
   */
  getRecentMessages(limit: number = 50, contact?: string): MessageResult[] {
    try {
      let filtered = [...this.messages];
      
      // Filter by contact if specified
      if (contact) {
        const contactLower = contact.toLowerCase();
        filtered = filtered.filter(msg => 
          msg.sender?.toLowerCase().includes(contactLower) ||
          msg.senderName?.toLowerCase().includes(contactLower)
        );
      }

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => b.timestamp - a.timestamp);
      
      // Convert to MessageResult format
      return filtered.slice(0, limit).map(msg => ({
        sender: msg.sender,
        senderName: msg.senderName,
        timestamp: msg.timestamp,
        body: msg.body,
        isGroup: msg.isGroup,
        groupId: msg.groupId,
      }));
    } catch (error) {
      console.error("Failed to get recent messages:", error);
      return [];
    }
  }

  /**
   * Clean up old messages (keep last 30 days by default)
   */
  cleanup(daysToKeep: number = 30): void {
    try {
      const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const originalLength = this.messages.length;
      
      this.messages = this.messages.filter(msg => msg.timestamp >= cutoffTimestamp);
      
      if (this.messages.length < originalLength) {
        this.saveCache();
      }
    } catch (error) {
      console.error("Failed to cleanup old messages:", error);
    }
  }

  /**
   * Close (save) the cache
   */
  close(): void {
    this.saveCache();
  }
}
