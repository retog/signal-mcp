# Production Deployment

This guide covers deploying Signal MCP Server for production use with HTTPS, authentication, and automatic startup.

## Architecture

```
Internet → nginx (HTTPS + Basic Auth) → Signal MCP Server (localhost:3000)
```

The Signal MCP Server runs locally without authentication. nginx handles:
- TLS termination (HTTPS)
- Basic Authentication
- Reverse Proxy

## 1. Install Dependencies

```bash
# Debian/Ubuntu
apt update
apt install nginx certbot apache2-utils
```

## 2. Configure Signal MCP as systemd Service

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
EOF
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable signal-mcp
systemctl start signal-mcp
```

**Important:** `HOST=127.0.0.1` ensures the server only listens locally.

## 3. Configure DNS

Create an A record pointing your subdomain to your server's IP address:

```
signal.example.com → YOUR_SERVER_IP
```

## 4. Create SSL Certificate

```bash
# Prepare webroot for ACME challenge
mkdir -p /var/www/html/.well-known/acme-challenge

# Request certificate
certbot certonly --webroot -w /var/www/html -d signal.example.com
```

Certbot automatically sets up a systemd timer for certificate renewal (runs twice daily).

## 5. Set Up Basic Authentication

```bash
htpasswd -c /etc/nginx/.htpasswd yourusername
```

## 6. Configure nginx

Create `/etc/nginx/sites-available/signal-mcp`:

```nginx
# HTTP Redirect
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

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name signal.example.com;

    ssl_certificate /etc/letsencrypt/live/signal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/signal.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # SSE endpoint
    location /sse {
        auth_basic "Signal MCP";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:3000/sse;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        
        # SSE-specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
        chunked_transfer_encoding off;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Message endpoint
    location /message {
        auth_basic "Signal MCP";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:3000/message;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

Enable and test:

```bash
ln -s /etc/nginx/sites-available/signal-mcp /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```


## 7. Configure MCP Client

Use this URL format for MCP clients (e.g., Claude.ai):

```
https://username:password@signal.example.com/sse
```

## 8. Verify Installation

```bash
# Without auth (should return 401)
curl -s -o /dev/null -w "%{http_code}" https://signal.example.com/sse

# With auth (should open SSE stream)
curl -u username:password https://signal.example.com/sse

# Check service status
systemctl status signal-mcp

# Check certificate renewal timer
systemctl list-timers | grep certbot
```

## Security Notes

1. **Strong password** - The Basic Auth password protects all access
2. **Firewall** - Only open ports 80 and 443
3. **Local binding** - Signal MCP should only listen on 127.0.0.1
4. **Monitor logs** - Check nginx access logs for unusual activity

## Troubleshooting

### 502 Bad Gateway
- Signal MCP not running: `systemctl status signal-mcp`
- Wrong port: `ss -tlnp | grep 3000`

### 504 Gateway Timeout
- SSE timeout too short: increase `proxy_read_timeout`

### SSL errors
- Certificate expired: `certbot renew`
- Wrong domain: check certificate and server_name match

### CORS errors
- Check CORS headers in nginx config
