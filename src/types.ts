/**
 * Type definitions for Signal CLI integration
 */

export interface SignalMessage {
  envelope: {
    source?: string;
    sourceNumber?: string;
    sourceUuid?: string;
    sourceName?: string;
    sourceDevice?: number;
    timestamp: number;
    dataMessage?: {
      timestamp: number;
      message?: string;
      expiresInSeconds?: number;
      viewOnce?: boolean;
      attachments?: SignalAttachment[];
      groupInfo?: {
        groupId: string;
        type: string;
      };
    };
    syncMessage?: {
      sentMessage?: {
        destination?: string;
        destinationNumber?: string;
        destinationUuid?: string;
        timestamp: number;
        message?: string;
        expiresInSeconds?: number;
        viewOnce?: boolean;
        attachments?: SignalAttachment[];
      };
    };
    receiptMessage?: {
      type: string;
      timestamps: number[];
    };
  };
  account: string;
}

export interface SignalAttachment {
  contentType: string;
  filename?: string;
  id: string;
  size?: number;
  width?: number;
  height?: number;
  caption?: string;
  uploadTimestamp?: number;
}

export interface SignalContact {
  number?: string;
  uuid?: string;
  name?: string;
  profileName?: string;
  color?: string;
  messageExpirationTime?: number;
  blocked?: boolean;
  archived?: boolean;
}

export interface SignalGroup {
  id: string;
  name?: string;
  description?: string;
  isMember: boolean;
  isBlocked: boolean;
  messageExpirationTime?: number;
  members?: SignalContact[];
  pendingMembers?: SignalContact[];
  requestingMembers?: SignalContact[];
  admins?: SignalContact[];
}

export interface MessageResult {
  sender: string;
  senderName?: string;
  timestamp: number;
  body?: string;
  attachments?: Array<{
    id: string;
    contentType: string;
    filename?: string;
    size?: number;
  }>;
  isGroup?: boolean;
  groupId?: string;
}

export interface ChatResult {
  contact: string;
  contactName?: string;
  lastMessage?: string;
  lastTimestamp?: number;
  isGroup?: boolean;
  groupName?: string;
}

export interface SendMessageResult {
  success: boolean;
  timestamp?: number;
  messageId?: string;
  error?: string;
}
