# Project File Structure

This document explains the purpose of each file in the Signal MCP Server project.

## Root Directory

### Configuration Files

- **deno.json** - Deno project configuration
  - Defines project metadata (name, version)
  - Configures tasks (start, dev)
  - Specifies dependencies (@modelcontextprotocol/sdk)
  - Sets TypeScript compiler options

- **.env.example** - Environment variable template
  - Shows required configuration (SIGNAL_ACCOUNT)
  - Documents optional settings (SIGNAL_CLI_PATH, SIGNAL_TIMEOUT)
  - Serves as a guide for users to create their own .env file

- **.gitignore** - Git ignore rules
  - Excludes Deno cache and lock files
  - Ignores environment files (.env)
  - Prevents committing IDE and OS-specific files

### Documentation Files

- **README.md** - Main project documentation
  - Features overview
  - Installation instructions
  - Configuration guide
  - API documentation for all tools
  - Troubleshooting tips
  - Links to related projects

- **QUICKSTART.md** - Step-by-step setup guide
  - Prerequisites checklist
  - Detailed installation steps
  - Account linking instructions
  - Claude Desktop configuration
  - Common troubleshooting scenarios

- **LICENSE** - MIT License
  - Open source license terms
  - Permissions and limitations

### Source Code

#### src/ Directory

- **src/index.ts** - Main MCP server entry point
  - Initializes Signal CLI client
  - Creates and configures MCP Server with HTTP transport
  - Registers 5 tools with schemas
  - Handles tool execution requests
  - Manages HTTP server with SSE transport
  - Routes /sse (GET), /message (POST), /health (GET) endpoints
  - Session management for multiple clients
  - Error handling and logging

- **src/signal-cli.ts** - Signal CLI integration layer
  - `SignalCLI` class for executing signal-cli commands
  - JSON output parsing
  - Message receiving and filtering
  - Contact and group listing
  - Message searching
  - Message sending
  - Media download handling
  - Error handling and timeouts

- **src/types.ts** - TypeScript type definitions
  - `SignalMessage` - Raw message format from signal-cli
  - `SignalAttachment` - Attachment metadata
  - `SignalContact` - Contact information
  - `SignalGroup` - Group information
  - `MessageResult` - Simplified message format for API responses
  - `ChatResult` - Chat/conversation listing format
  - `SendMessageResult` - Message send response format

### Testing

- **test.ts** - Basic validation script
  - Tests Deno runtime
  - Validates TypeScript compilation
  - Verifies imports
  - Checks MCP SDK integration
  - Provides setup instructions

## Tool Flow

```
┌─────────────────┐
│   MCP Client    │
│  (HTTP/SSE)     │
└────────┬────────┘
         │ GET /sse (SSE stream)
         │ POST /message (JSON-RPC)
         ▼
┌─────────────────┐
│  HTTP Server    │
│ (Deno std/http) │
│  - GET /sse     │
│  - POST /message│
│  - GET /health  │
└────────┬────────┘
         │ SSEServerTransport
         ▼
┌─────────────────┐
│  src/index.ts   │
│  (MCP Server)   │
│  - Tool schemas │
│  - Request      │
│    handlers     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ src/signal-cli  │
│     .ts         │
│  - Execute      │
│    signal-cli   │
│  - Parse JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   signal-cli    │
│   (External)    │
│  - Signal API   │
└─────────────────┘
```

## Data Flow Example

### Receiving Messages

1. MCP client sends JSON-RPC request via POST /message
2. HTTP server routes to SSEServerTransport
3. MCP Server receives tool call request
4. `src/index.ts` handles the `receive_messages` tool
5. Calls `SignalCLI.receiveMessages()`
6. `src/signal-cli.ts` executes: `signal-cli -a ACCOUNT --output=json receive`
7. Parses JSON output into `MessageResult[]` using types from `src/types.ts`
8. Returns formatted JSON via SSE stream back to client

### Sending Messages

1. MCP client sends `send_message` tool request (requires user approval)
2. `src/index.ts` validates parameters
3. Calls `SignalCLI.sendMessage(recipient, message)`
4. `src/signal-cli.ts` determines if group or individual
5. Executes: `signal-cli -a ACCOUNT --output=json send -m "message" RECIPIENT`
6. Returns `SendMessageResult` with success/error

## Development Workflow

1. Edit source files in `src/`
2. Run `deno task dev` for hot-reload development
3. Test with `DENO_TLS_CA_STORE=system deno run --allow-all test.ts`
4. Check types with `DENO_TLS_CA_STORE=system deno check src/index.ts`
5. Start HTTP server with `deno task start`
6. Test endpoints with `curl http://localhost:3000/health`
7. Connect MCP clients to `http://localhost:3000/sse`

## Dependencies

- **Runtime**: Deno 2.6.3+
- **HTTP Server**: Deno standard library (std@0.208.0/http/server.ts)
- **MCP SDK**: @modelcontextprotocol/sdk (npm)
- **External**: signal-cli (system binary)

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| SIGNAL_ACCOUNT | Required | Phone number for signal-cli |
| SIGNAL_CLI_PATH | Optional | Custom path to signal-cli binary |
| SIGNAL_TIMEOUT | Optional | Command timeout in milliseconds |
| PORT | Optional | HTTP server port (default: 3000) |
| HOST | Optional | HTTP server host (default: 0.0.0.0) |
| DENO_TLS_CA_STORE | Required | Set to "system" for SSL certificates |
