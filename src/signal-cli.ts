/**
 * Utility functions for interacting with signal-cli
 */

import type {
  MessageResult,
  SignalMessage,
  ChatResult,
  SignalContact,
  SignalGroup,
  SendMessageResult,
} from "./types.ts";

export class SignalCLI {
  private signalCliPath: string;
  private account: string;
  private timeout: number;

  constructor(
    signalCliPath: string = "signal-cli",
    account?: string,
    timeout: number = 30000,
  ) {
    this.signalCliPath = signalCliPath;
    this.account = account || Deno.env.get("SIGNAL_ACCOUNT") || "";
    this.timeout = timeout;

    if (!this.account) {
      throw new Error(
        "SIGNAL_ACCOUNT environment variable must be set or account must be provided",
      );
    }
  }

  /**
   * Execute a signal-cli command and return parsed JSON output
   */
  private async execute(args: string[]): Promise<unknown> {
    const fullArgs = [
      "-a",
      this.account,
      "--output=json",
      ...args,
    ];

    const command = new Deno.Command(this.signalCliPath, {
      args: fullArgs,
      stdout: "piped",
      stderr: "piped",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const process = command.spawn();
      const { code, stdout, stderr } = await process.output();

      clearTimeout(timeoutId);

      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`signal-cli error (exit code ${code}): ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);
      
      // Handle empty output
      if (!output.trim()) {
        return null;
      }

      // Parse line-delimited JSON
      const lines = output.trim().split("\n");
      const results = lines
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            console.error("Failed to parse JSON line:", line);
            return null;
          }
        })
        .filter((item) => item !== null);

      return results.length === 1 ? results[0] : results;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            `signal-cli command timeout after ${this.timeout}ms`,
          );
        }
        throw error;
      }
      throw new Error(`Unexpected error: ${error}`);
    }
  }

  /**
   * Receive messages from Signal
   */
  async receiveMessages(
    limit?: number,
    since?: number,
  ): Promise<MessageResult[]> {
    try {
      const args = ["receive", "--timeout", "1"];

      const result = await this.execute(args);
      
      if (!result) {
        return [];
      }

      const messages = Array.isArray(result) ? result : [result];
      
      let parsedMessages = messages
        .filter((msg: SignalMessage) => msg?.envelope)
        .map((msg: SignalMessage) => this.parseMessage(msg))
        .filter((msg): msg is MessageResult => msg !== null);

      // Apply since filter if provided
      if (since) {
        parsedMessages = parsedMessages.filter((msg) => msg.timestamp >= since);
      }

      // Apply limit if provided
      if (limit && limit > 0) {
        parsedMessages = parsedMessages.slice(0, limit);
      }

      return parsedMessages;
    } catch (error) {
      throw new Error(
        `Failed to receive messages: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Parse a Signal message into a simplified format
   */
  private parseMessage(msg: SignalMessage): MessageResult | null {
    const envelope = msg.envelope;
    if (!envelope) return null;

    const dataMessage = envelope.dataMessage || envelope.syncMessage?.sentMessage;
    if (!dataMessage) return null;

    const sender = envelope.sourceNumber || envelope.source || 
                   envelope.syncMessage?.sentMessage?.destinationNumber || 
                   envelope.syncMessage?.sentMessage?.destination || 
                   "unknown";
    
    const senderName = envelope.sourceName || undefined;
    const timestamp = dataMessage.timestamp || envelope.timestamp;
    const body = dataMessage.message;
    const groupId = envelope.dataMessage?.groupInfo?.groupId;

    const attachments = dataMessage.attachments?.map((att) => ({
      id: att.id,
      contentType: att.contentType,
      filename: att.filename,
      size: att.size,
    }));

    return {
      sender,
      senderName,
      timestamp,
      body,
      attachments,
      isGroup: !!groupId,
      groupId,
    };
  }

  /**
   * List all contacts
   */
  async listContacts(): Promise<SignalContact[]> {
    try {
      const result = await this.execute(["listContacts"]);
      
      if (!result) {
        return [];
      }

      const contacts = Array.isArray(result) ? result : [result];
      return contacts as SignalContact[];
    } catch (error) {
      throw new Error(
        `Failed to list contacts: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * List all groups
   */
  async listGroups(): Promise<SignalGroup[]> {
    try {
      const result = await this.execute(["listGroups", "-d"]);
      
      if (!result) {
        return [];
      }

      const groups = Array.isArray(result) ? result : [result];
      return groups as SignalGroup[];
    } catch (error) {
      throw new Error(
        `Failed to list groups: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * List all chats (contacts and groups with recent activity)
   */
  async listChats(): Promise<ChatResult[]> {
    try {
      const [contacts, groups] = await Promise.all([
        this.listContacts(),
        this.listGroups(),
      ]);

      const chats: ChatResult[] = [];

      // Add contacts
      for (const contact of contacts) {
        if (contact.number || contact.uuid) {
          chats.push({
            contact: contact.number || contact.uuid || "unknown",
            contactName: contact.name || contact.profileName,
            isGroup: false,
          });
        }
      }

      // Add groups
      for (const group of groups) {
        if (group.isMember) {
          chats.push({
            contact: group.id,
            contactName: group.name,
            isGroup: true,
            groupName: group.name,
          });
        }
      }

      return chats;
    } catch (error) {
      throw new Error(
        `Failed to list chats: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Check if a string is likely a Signal group ID (base64 encoded)
   */
  private isGroupId(recipient: string): boolean {
    // Signal group IDs are base64 encoded and typically longer than phone numbers
    // They often end with '=' or '==' for padding
    // Phone numbers start with '+' and are typically 10-15 digits
    if (recipient.startsWith("+")) {
      return false;
    }
    // Check for base64 pattern (alphanumeric + / + and optionally ending with =)
    const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
    return base64Pattern.test(recipient) && recipient.length > 20;
  }

  /**
   * Send a message to a recipient
   */
  async sendMessage(
    recipient: string,
    message: string,
  ): Promise<SendMessageResult> {
    try {
      const args = ["send", "-m", message];
      
      // Check if recipient is a group ID (base64 encoded)
      if (this.isGroupId(recipient)) {
        args.push("-g", recipient);
      } else {
        args.push(recipient);
      }

      const result = await this.execute(args);
      
      return {
        success: true,
        timestamp: Date.now(),
        messageId: JSON.stringify(result),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search messages (simple text search through received messages)
   * Note: signal-cli doesn't have built-in search, so this is a basic implementation
   */
  async searchMessages(
    query: string,
    contact?: string,
    searchLimit: number = 500,
  ): Promise<MessageResult[]> {
    try {
      // Receive recent messages with configurable limit
      const messages = await this.receiveMessages(searchLimit);
      
      const lowerQuery = query.toLowerCase();
      
      let filtered = messages.filter((msg) => {
        const bodyMatch = msg.body?.toLowerCase().includes(lowerQuery);
        const senderMatch = msg.sender?.toLowerCase().includes(lowerQuery);
        const nameMatch = msg.senderName?.toLowerCase().includes(lowerQuery);
        return bodyMatch || senderMatch || nameMatch;
      });

      // Filter by contact if provided
      if (contact) {
        const lowerContact = contact.toLowerCase();
        filtered = filtered.filter((msg) => {
          return msg.sender?.toLowerCase().includes(lowerContact) ||
                 msg.senderName?.toLowerCase().includes(lowerContact);
        });
      }

      return filtered;
    } catch (error) {
      throw new Error(
        `Failed to search messages: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Download media attachment
   * Note: signal-cli automatically downloads attachments during receive
   * This returns the path information
   */
  async downloadMedia(
    messageId: string,
    attachmentId: string,
  ): Promise<{ path?: string; data?: string; error?: string }> {
    try {
      // In signal-cli, attachments are downloaded automatically during receive
      // The attachment ID contains the path information
      // For now, we'll return the attachment ID as the path
      return {
        path: attachmentId,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
