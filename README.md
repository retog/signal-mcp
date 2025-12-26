# Signal MCP Server

An unofficial [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for [Signal](https://signal.org) messenger, enabling Claude and other MCP clients to interact with Signal through [signal-cli](https://github.com/AsamK/signal-cli).

## Features

- 📨 Receive and read Signal messages
- 💬 List all conversations (contacts and groups)
- 🔍 Search message history
- 📎 Download media attachments
- ✉️ Send messages (requires user approval)

## Local Development

### Prerequisites

Install Deno and signal-cli:

```bash
# Deno
curl -fsSL https://deno.land/install.sh | sh

# signal-cli (macOS)
brew install signal-cli

# signal-cli (Linux)
wget https://github.com/AsamK/signal-cli/releases/download/v0.13.9/signal-cli-0.13.9-Linux.tar.gz
tar xf signal-cli-0.13.9-Linux.tar.gz -C /opt
sudo ln -sf /opt/signal-cli-0.13.9/bin/signal-cli /usr/local/bin/
```

### Link Signal Account

```bash
signal-cli -a +YOUR_PHONE_NUMBER link -n "signal-mcp"
```

Scan the QR code with Signal app: Settings → Linked Devices → Link New Device

### Run the Server

```bash
git clone https://github.com/retog/signal-mcp.git
cd signal-mcp

export SIGNAL_ACCOUNT="+YOUR_PHONE_NUMBER"
deno task start
```

The server runs on `http://localhost:3000`. Test it:

```bash
curl http://localhost:3000/health
```

### Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIGNAL_ACCOUNT` | (required) | Your phone number with country code |
| `SIGNAL_CLI_PATH` | `signal-cli` | Path to signal-cli binary |
| `SIGNAL_TIMEOUT` | `30000` | Timeout in milliseconds |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server host |


## Production Deployment

For production use, you need HTTPS and authentication. This section covers deploying on a Linux server with nginx.

### 1. Install Dependencies

```bash
apt update
apt install nginx certbot apache2-utils
```

### 2. Configure systemd Service

Create `/etc/systemd/system/signal-mcp.service`:

```ini
[Unit]
Description=Signal MCP Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/signal-mcp
Environment=SIGNAL_ACCOUNT=+1234567890
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/home/youruser/.deno/bin/deno task start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable signal-mcp
systemctl start signal-mcp
```

### 3. Configure DNS

Create an A record pointing your subdomain to your server's IP:

```
signal.example.com → YOUR_SERVER_IP
```

### 4. Create SSL Certificate

```bash
mkdir -p /var/www/html/.well-known/acme-challenge
certbot certonly --webroot -w /var/www/html -d signal.example.com
```

Certbot automatically renews certificates via systemd timer.

### 5. Set Up Authentication

```bash
htpasswd -c /etc/nginx/.htpasswd yourusername
```


### 6. Configure nginx

Create `/etc/nginx/sites-available/signal-mcp`:

```nginx
server {
    listen 80;
    server_name signal.example.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name signal.example.com;

    ssl_certificate /etc/letsencrypt/live/signal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/signal.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location /sse {
        auth_basic "Signal MCP";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:3000/sse;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
        chunked_transfer_encoding off;
        
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    location /message {
        auth_basic "Signal MCP";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:3000/message;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/signal-mcp /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```


## Connecting to Claude.ai

Once your server is running with HTTPS, register it in Claude.ai:

1. Go to [claude.ai/settings/connectors](https://claude.ai/settings/connectors)
2. Click "Add Connector"
3. Enter the URL with credentials:

```
https://username:password@signal.example.com/sse
```

The URL uses standard HTTP Basic Auth format:
- `username` - the username from htpasswd
- `password` - your password (URL-encode special characters, e.g., `@` → `%40`)

### Verify Connection

After adding the connector, start a new conversation and ask Claude:

> "Show me my recent Signal messages"

Claude should be able to access your Signal messages through the MCP server.

## Connecting to VS Code with GitHub Copilot

VS Code with GitHub Copilot supports MCP servers in Agent Mode. Unlike Claude.ai, VS Code doesn't accept credentials in the URL. Instead, you configure an `Authorization` header.

### 1. Generate the Authorization Header

Basic Auth requires Base64-encoded credentials. Generate the header value:

```bash
echo -n "username:password" | base64
```

Example:
```bash
echo -n "reto:mysecretpassword" | base64
# Output: cmV0bzpteXNlY3JldHBhc3N3b3Jk
```

### 2. Configure VS Code

Create or edit `.vscode/mcp.json` in your workspace (or add to your user `settings.json`):

```json
{
  "servers": {
    "signal": {
      "type": "http",
      "url": "https://signal.example.com/sse",
      "headers": {
        "Authorization": "Basic cmV0bzpteXNlY3JldHBhc3N3b3Jk"
      }
    }
  }
}
```

Replace the Base64 string with the output from step 1.

### 3. Start the Server

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `MCP: List Servers`
3. Click "Start" next to the Signal server

### 4. Use in Agent Mode

1. Open GitHub Copilot Chat
2. Switch to "Agent" mode (dropdown at bottom of chat)
3. Click the Tools icon to verify Signal tools are available
4. Ask: "Show me my recent Signal messages"

## Tools Reference

For detailed documentation of all available tools (receive_messages, send_message, search_messages, etc.), see [TOOLS.md](TOOLS.md).

## Troubleshooting

### signal-cli not found

```bash
export SIGNAL_CLI_PATH="/opt/signal-cli-0.13.9/bin/signal-cli"
```

### 502 Bad Gateway

Check if the service is running:

```bash
systemctl status signal-mcp
ss -tlnp | grep 3000
```

### SSL errors

Renew certificate:

```bash
certbot renew
```

### No messages received

Test signal-cli directly:

```bash
signal-cli -a +YOUR_PHONE_NUMBER receive
```


## Security

- Store credentials in environment variables, never in code
- Message sends require explicit user approval in Claude
- Use `HOST=127.0.0.1` to bind locally when behind a proxy
- Use strong passwords for Basic Auth

## Development

Run with auto-reload:

```bash
deno task dev
```

## License

MIT

## Credits

- [signal-cli](https://github.com/AsamK/signal-cli) - Command-line interface for Signal
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol SDK
- [Signal Messenger](https://signal.org) - Private messaging platform

## Disclaimer

This is an unofficial tool and is not affiliated with or endorsed by Signal Messenger LLC.
