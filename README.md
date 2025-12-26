# Signal MCP Server

An unofficial [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Signal](https://signal.org) messenger, enabling Claude and other MCP clients to interact with Signal through [signal-cli](https://github.com/AsamK/signal-cli).

## Features

- **Read Operations**:
  - 📨 Receive and read Signal messages
  - 💬 List all conversations (contacts and groups)
  - 🔍 Search message history
  - 📎 Download media attachments

- **Write Operations**:
  - ✉️ Send Signal messages (each send requires user approval in Claude)

## Prerequisites

1. **Deno Runtime**: Install from [deno.land](https://deno.land/)
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **signal-cli**: Install and configure signal-cli
   ```bash
   # macOS (using Homebrew)
   brew install signal-cli

   # Linux
   # Download from https://github.com/AsamK/signal-cli/releases
   wget https://github.com/AsamK/signal-cli/releases/download/v0.13.9/signal-cli-0.13.9-Linux.tar.gz
   tar xf signal-cli-0.13.9-Linux.tar.gz -C /opt
   ln -sf /opt/signal-cli-0.13.9/bin/signal-cli /usr/local/bin/
   ```

3. **Register Signal Account**: Link your Signal account with signal-cli
   ```bash
   # Register a new number
   signal-cli -a +YOUR_PHONE_NUMBER register

   # Verify with the code you receive
   signal-cli -a +YOUR_PHONE_NUMBER verify CODE

   # OR link to an existing Signal account (recommended)
   signal-cli -a +YOUR_PHONE_NUMBER link -n "signal-mcp"
   # Scan the QR code with your Signal app: Settings > Linked Devices > Link New Device
   ```

## Installation

Clone this repository:

```bash
git clone https://github.com/retog/signal-mcp.git
cd signal-mcp
```

## Configuration

Set up the required environment variable:

```bash
export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"
```

Optional environment variables:

```bash
# Path to signal-cli binary (defaults to "signal-cli" in PATH)
export SIGNAL_CLI_PATH="/opt/signal-cli/bin/signal-cli"

# Timeout for signal-cli commands in milliseconds (default: 30000)
export SIGNAL_TIMEOUT="30000"

# HTTP server port (default: 3000)
export PORT="3000"

# HTTP server host (default: 0.0.0.0)
export HOST="0.0.0.0"
```

## Usage

### Running the HTTP Server

Start the server:

```bash
# Using default port 3000
deno task start

# Or specify a custom port
PORT=8080 SIGNAL_ACCOUNT="+1234567890" deno task start
```

The server will start on `http://0.0.0.0:3000` (or your specified port) and provide the following endpoints:

- **GET /sse** - Server-Sent Events endpoint for MCP streaming communication
- **POST /message?sessionId=<id>** - Message endpoint for client requests
- **GET /health** - Health check endpoint

### Connecting MCP Clients

MCP clients should connect to the `/sse` endpoint using HTTP streaming. The server will:
1. Establish an SSE connection on GET /sse
2. Send an `endpoint` event with the message POST URL including session ID
3. Accept JSON-RPC messages via POST /message with the session ID parameter

### Claude Desktop Configuration (HTTP)

For HTTP-based MCP connection, you'll need to run the server separately and configure Claude to connect to it.

**Step 1: Start the Signal MCP server**

```bash
export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"
cd /path/to/signal-mcp
deno task start
```

**Step 2: Configure Claude Desktop to use HTTP transport**

Note: As of December 2024, Claude Desktop primarily supports stdio-based MCP servers. For HTTP/SSE transport, you may need to use a different MCP client or wait for Claude Desktop to add HTTP transport support.

Alternative approach - Use stdio transport (legacy):

If you prefer stdio transport for Claude Desktop compatibility, you can use an older version or contribute to adding HTTP support to Claude Desktop.

For other MCP clients that support HTTP/SSE transport:

```json
{
  "mcpServers": {
    "signal": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

## Usage

### Running Standalone (HTTP Server)

Start the Signal MCP server:

```bash
export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"
deno task start
```

The server will be accessible at `http://localhost:3000`. You can test it:

```bash
# Health check
curl http://localhost:3000/health
```

### Available Tools

#### 1. `receive_messages`

Receive new messages from Signal.

**Parameters:**
- `limit` (optional): Maximum number of messages to return
- `since` (optional): Unix timestamp - only return messages after this time

**Example:**
```typescript
{
  "limit": 10,
  "since": 1703001600000
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
    "attachments": [],
    "isGroup": false
  }
]
```

#### 2. `list_chats`

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

#### 3. `search_messages`

Search through Signal message history.

**Parameters:**
- `query` (required): Search query to find in messages
- `contact` (optional): Filter results to messages from this contact

**Example:**
```typescript
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

#### 4. `download_media`

Download media attachments from Signal messages.

**Parameters:**
- `messageId` (required): ID of the message containing the attachment
- `attachmentId` (required): ID of the attachment to download

**Example:**
```typescript
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

#### 5. `send_message`

Send a message via Signal. **Requires individual approval in Claude for each send.**

**Parameters:**
- `recipient` (required): Phone number with country code (e.g., `+1234567890`) or group ID
- `message` (required): Message text to send

**Example:**
```typescript
{
  "recipient": "+1234567890",
  "message": "Hello from Signal MCP!"
}
```

**Returns:**
```json
{
  "success": true,
  "timestamp": 1703088000000,
  "messageId": "..."
}
```

## How It Works

1. **MCP Protocol**: The server implements the Model Context Protocol, allowing MCP clients to discover and use the Signal tools.

2. **signal-cli Integration**: All Signal operations are performed using signal-cli with JSON output (`--output=json`), ensuring structured, parseable responses.

3. **HTTP Streaming Transport**: Uses HTTP with Server-Sent Events (SSE) for real-time bidirectional communication between MCP clients and the server.
   - Clients connect to `/sse` endpoint via HTTP GET
   - Server streams events using SSE protocol  
   - Clients send messages via HTTP POST to `/message` endpoint
   - Each connection gets a unique session ID for routing

4. **Security**: 
   - Read operations (receive, list, search) are marked for auto-approval
   - Write operations (send_message) require individual user approval for each execution
   - All credentials are managed via environment variables

## Troubleshooting

### signal-cli not found

Make sure signal-cli is in your PATH or set `SIGNAL_CLI_PATH` environment variable:

```bash
export SIGNAL_CLI_PATH="/opt/signal-cli/bin/signal-cli"
```

### Account not registered

Ensure you've registered or linked your Signal account with signal-cli:

```bash
signal-cli -a +YOUR_PHONE_NUMBER link -n "signal-mcp"
```

### Permission errors

The Deno process needs `--allow-all` permissions to:
- Execute signal-cli binary
- Read environment variables
- Start HTTP server and accept network connections

### No messages received

- Check that signal-cli can receive messages: `signal-cli -a +YOUR_PHONE_NUMBER receive`
- Ensure your Signal account is active and properly linked
- Try increasing the timeout: `export SIGNAL_TIMEOUT="60000"`

## Development

Run in development mode with auto-reload:

```bash
deno task dev
```

## Security Considerations

- **Environment Variables**: Store sensitive data (phone numbers) in environment variables, never in code
- **Approval Required**: All message sends require explicit user approval in MCP clients
- **signal-cli Security**: Follow signal-cli security best practices for account management
- **Network Security**: The HTTP server binds to 0.0.0.0 by default - use firewall rules or change HOST to localhost for local-only access
- **CORS**: The server includes CORS headers for cross-origin requests - adjust as needed for production
- **Production Deployment**: For production use with HTTPS and authentication, see [PRODUCTION.md](PRODUCTION.md)

## License

MIT

## Credits

- [signal-cli](https://github.com/AsamK/signal-cli) - Command-line interface for Signal
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol SDK
- [Signal Messenger](https://signal.org) - Private messaging platform

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Disclaimer

This is an unofficial tool and is not affiliated with or endorsed by Signal Messenger LLC.
