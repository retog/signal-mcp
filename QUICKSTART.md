# Quick Start Guide

This guide will help you get the Signal MCP Server up and running quickly.

## Prerequisites Checklist

- [ ] Deno runtime installed
- [ ] signal-cli installed and in PATH
- [ ] Signal account registered/linked with signal-cli
- [ ] SIGNAL_ACCOUNT environment variable set

## Step-by-Step Setup

### 1. Install Deno

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
```

### 2. Install signal-cli

**macOS:**
```bash
brew install signal-cli
```

**Linux:**
```bash
# Download latest release
wget https://github.com/AsamK/signal-cli/releases/download/v0.13.9/signal-cli-0.13.9-Linux.tar.gz
tar xf signal-cli-0.13.9-Linux.tar.gz -C /opt
sudo ln -sf /opt/signal-cli-0.13.9/bin/signal-cli /usr/local/bin/

# Verify installation
signal-cli --version
```

### 3. Link Your Signal Account

**Option A: Link to existing Signal app (Recommended)**
```bash
signal-cli -a +YOUR_PHONE_NUMBER link -n "signal-mcp"
```

This will display a QR code. Scan it with your Signal app:
1. Open Signal on your phone
2. Go to Settings → Linked Devices
3. Tap "Link New Device"
4. Scan the QR code

**Option B: Register a new number**
```bash
# Request verification code
signal-cli -a +YOUR_PHONE_NUMBER register

# Enter the code you receive
signal-cli -a +YOUR_PHONE_NUMBER verify CODE
```

### 4. Test signal-cli

```bash
# Test receiving messages
signal-cli -a +YOUR_PHONE_NUMBER receive

# Test listing contacts
signal-cli -a +YOUR_PHONE_NUMBER listContacts --output=json
```

### 5. Configure Environment

```bash
# Set your Signal account number
export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"

# Optional: If signal-cli is not in PATH
export SIGNAL_CLI_PATH="/opt/signal-cli-0.13.9/bin/signal-cli"
```

### 6. Start the MCP Server

```bash
# Clone the repository
git clone https://github.com/retog/signal-mcp.git
cd signal-mcp

# Run the test script
DENO_TLS_CA_STORE=system deno run --allow-all test.ts

# Start the HTTP server
export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"
deno task start
```

The server will start on `http://localhost:3000`. You should see:
```
Signal MCP Server starting on http://0.0.0.0:3000
Account: +YOUR_PHONE_NUMBER
Signal CLI path: signal-cli
Endpoint: /sse
```

Test the server:
```bash
curl http://localhost:3000/health
```

### 7. Connect MCP Clients

The Signal MCP server now runs as an HTTP service. MCP clients should connect to:

- **SSE Endpoint**: `http://localhost:3000/sse`
- **Transport**: HTTP with Server-Sent Events

**Note**: As of December 2024, Claude Desktop primarily supports stdio-based MCP servers. For HTTP/SSE transport, you may need to:
- Use a custom MCP client that supports HTTP transport
- Wait for Claude Desktop to add native HTTP transport support
- Use a proxy/bridge to convert between stdio and HTTP

## Testing the Server

Once the server is running, test it with:

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok"}
```

### Using with MCP Clients

Configure your MCP client to connect to `http://localhost:3000/sse` using SSE transport.

## Troubleshooting

### "signal-cli not found"
- Ensure signal-cli is in your PATH or set SIGNAL_CLI_PATH
- Verify with: `which signal-cli`

### "SIGNAL_ACCOUNT environment variable must be set"
- Make sure you set the environment variable in Claude's config
- Use the full international format: +1234567890

### "Failed to receive messages"
- Test signal-cli directly: `signal-cli -a +YOUR_PHONE_NUMBER receive`
- Ensure your account is properly linked
- Check that Signal is active on your phone

### "Type checking failed" or "Import errors"
- Make sure DENO_TLS_CA_STORE=system is set in the environment
- Try clearing Deno cache: `deno cache --reload src/index.ts`

### Claude doesn't show Signal tools
- Verify the config file path is correct
- Check Claude Desktop logs for errors
- Restart Claude Desktop completely

## Next Steps

Once everything is working:

1. Try receiving messages: "Show me my recent Signal messages"
2. Search your history: "Search for messages about 'project'"
3. Send a message: "Send a Signal message to +1234567890 saying 'Hello!'" (requires approval)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the full README.md for detailed documentation
3. Check signal-cli documentation: https://github.com/AsamK/signal-cli
4. File an issue on GitHub: https://github.com/retog/signal-mcp/issues
