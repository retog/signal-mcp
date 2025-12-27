# MCP Tools Reference

This document describes all available tools provided by the Signal MCP Server.

## Overview

| Tool | Description | Approval |
|------|-------------|----------|
| `get_messages` | Get recent messages | Auto |
| `list_chats` | List conversations | Auto |
| `search_messages` | Search message history | Auto |
| `download_media` | Download attachments | Auto |
| `get_recent_chats` | Get recent chats sorted by time | Auto |
| `send_message` | Send a message | Required |

## Tools

### get_messages

Get recent Signal messages. This is the recommended way to read messages. It fetches new messages from Signal first, then returns the most recent messages from cache.

**Parameters:**
- `limit` (optional): Maximum number of messages to return (default: 50, max: 500)
- `contact` (optional): Filter to messages from this contact (phone number or name)

**Example:**
```json
{
  "limit": 20,
  "contact": "+1234567890"
}
```

**Returns:**
```json
[
  {
    "sender": "+1234567890",
    "senderName": "John Doe",
    "timestamp": 1703088000000,
    "body": "Hello from Signal!",
    "isGroup": false
  }
]
```

### list_chats

List all Signal conversations (contacts and groups).

**Parameters:** None

**Returns:**
```json
[
  {
    "contact": "+1234567890",
    "contactName": "John Doe",
    "isGroup": false
  },
  {
    "contact": "base64-encoded-group-id==",
    "contactName": "My Group Chat",
    "isGroup": true,
    "groupName": "My Group Chat"
  }
]
```


### search_messages

Search through Signal message history.

**Parameters:**
- `query` (required): Search query to find in messages
- `contact` (optional): Filter results to messages from this contact

**Example:**
```json
{
  "query": "meeting",
  "contact": "+1234567890"
}
```

**Returns:**
```json
[
  {
    "sender": "+1234567890",
    "senderName": "John Doe",
    "timestamp": 1703088000000,
    "body": "Let's schedule a meeting for tomorrow",
    "attachments": [],
    "isGroup": false
  }
]
```

### download_media

Download media attachments from Signal messages.

**Parameters:**
- `messageId` (required): ID of the message containing the attachment
- `attachmentId` (required): ID of the attachment to download

**Example:**
```json
{
  "messageId": "msg123",
  "attachmentId": "att456"
}
```

**Returns:**
```json
{
  "path": "/path/to/downloaded/file"
}
```

### get_recent_chats

Get recent chats sorted by last message time.

**Parameters:**
- `limit` (optional): Maximum number of chats to return (default: 20)

**Returns:**
```json
[
  {
    "contact": "+1234567890",
    "contactName": "John Doe",
    "lastMessage": "See you tomorrow!",
    "timestamp": 1703088000000
  }
]
```

### send_message

Send a message via Signal. **Requires user approval for each send.**

**Parameters:**
- `recipient` (required): Phone number with country code (e.g., `+1234567890`) or group ID
- `message` (required): Message text to send

**Example:**
```json
{
  "recipient": "+1234567890",
  "message": "Hello from Signal MCP!"
}
```

**Returns:**
```json
{
  "success": true,
  "timestamp": 1703088000000
}
```

## How It Works

1. **MCP Protocol**: The server implements the Model Context Protocol, allowing MCP clients to discover and use the Signal tools.

2. **signal-cli Integration**: All Signal operations are performed using signal-cli with JSON output, ensuring structured, parseable responses.

3. **HTTP Streaming Transport**: Uses HTTP with Server-Sent Events (SSE) for real-time bidirectional communication.
   - Clients connect to `/sse` endpoint via HTTP GET
   - Server streams events using SSE protocol  
   - Clients send messages via HTTP POST to `/message` endpoint
   - Each connection gets a unique session ID for routing
