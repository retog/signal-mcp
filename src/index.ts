#!/usr/bin/env -S deno run --allow-all

/**
 * Signal MCP Server
 * 
 * An MCP server that provides tools for interacting with Signal messenger
 * via signal-cli.
 * 
 * This server uses HTTP with streaming transport for MCP communication.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SignalCLI } from "./signal-cli.ts";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Initialize Signal CLI
const signalCliPath = Deno.env.get("SIGNAL_CLI_PATH") || "signal-cli";
const signalAccount = Deno.env.get("SIGNAL_ACCOUNT");
const signalTimeout = parseInt(Deno.env.get("SIGNAL_TIMEOUT") || "30000", 10);

let signalCli: SignalCLI;

try {
  signalCli = new SignalCLI(signalCliPath, signalAccount, signalTimeout);
} catch (error) {
  console.error("Failed to initialize Signal CLI:", error);
  Deno.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: "signal-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Tool: get_messages
 * Get recent messages from Signal
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_messages",
        description:
          "Get recent Signal messages. Fetches new messages from Signal first, then returns the most recent messages from cache. This is the recommended way to read messages.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of messages to return (default: 50)",
              minimum: 1,
              maximum: 500,
            },
            contact: {
              type: "string",
              description: "Optional: filter to messages from this contact (phone number or name)",
            },
          },
        },
      },
      {
        name: "list_chats",
        description:
          "List all Signal conversations (contacts and groups). Returns an array of chats with contact information.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_recent_chats",
        description:
          "Get recent chats sorted by last message time. Returns an array of chats with last message info and timestamps. This is the PREFERRED tool for viewing active conversations.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of chats to return (default: 20)",
              minimum: 1,
              maximum: 100,
            },
          },
        },
      },
      {
        name: "search_messages",
        description:
          "Search through Signal message history. Returns matching messages with context.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to find in messages",
            },
            contact: {
              type: "string",
              description:
                "Optional: filter results to messages from this contact (phone number or name)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "download_media",
        description:
          "Download media attachments from Signal messages. Returns file path or base64 data.",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "ID of the message containing the attachment",
            },
            attachmentId: {
              type: "string",
              description: "ID of the attachment to download",
            },
          },
          required: ["messageId", "attachmentId"],
        },
      },
      {
        name: "send_message",
        description:
          "Send a message via Signal. Requires individual approval for each send. Recipient can be a phone number (e.g., +1234567890) or group ID.",
        inputSchema: {
          type: "object",
          properties: {
            recipient: {
              type: "string",
              description:
                "Phone number (with country code, e.g., +1234567890) or group ID",
            },
            message: {
              type: "string",
              description: "Message text to send",
            },
          },
          required: ["recipient", "message"],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_messages": {
        const limit = (args?.limit as number) || 50;
        const contact = args?.contact as string | undefined;

        const messages = await signalCli.getMessages(limit, contact);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      }

      case "list_chats": {
        const chats = await signalCli.listChats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(chats, null, 2),
            },
          ],
        };
      }

      case "get_recent_chats": {
        const limit = (args?.limit as number) || 20;
        const recentChats = signalCli.getRecentChats(limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(recentChats, null, 2),
            },
          ],
        };
      }

      case "search_messages": {
        const query = args?.query as string;
        const contact = args?.contact as string | undefined;

        if (!query) {
          throw new Error("query parameter is required");
        }

        const results = await signalCli.searchMessages(query, contact);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "download_media": {
        const messageId = args?.messageId as string;
        const attachmentId = args?.attachmentId as string;

        if (!messageId || !attachmentId) {
          throw new Error("messageId and attachmentId parameters are required");
        }

        const result = await signalCli.downloadMedia(messageId, attachmentId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "send_message": {
        const recipient = args?.recipient as string;
        const message = args?.message as string;

        if (!recipient || !message) {
          throw new Error("recipient and message parameters are required");
        }

        const result = await signalCli.sendMessage(recipient, message);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: errorMessage,
              success: false,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server with HTTP streaming transport
 */
async function main() {
  const port = parseInt(Deno.env.get("PORT") || "3000", 10);
  const host = Deno.env.get("HOST") || "0.0.0.0";
  
  console.error(`Signal MCP Server starting on http://${host}:${port}`);
  console.error(`Account: ${signalAccount}`);
  console.error(`Signal CLI path: ${signalCliPath}`);
  console.error(`Endpoint: /sse`);

  // Store active transports by session ID
  const transports = new Map<string, SSEServerTransport>();

  await serve(async (req) => {
    const url = new URL(req.url);
    
    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // SSE connection endpoint (GET request)
    if (url.pathname === "/sse" && req.method === "GET") {
      // Create response for SSE streaming
      const body = new ReadableStream({
        start(controller) {
          // Create transport with a custom response wrapper
          const responseWrapper = {
            writeHead: (status: number, headers: Record<string, string>) => {
              // Headers will be set on the Response object
            },
            write: (data: string) => {
              controller.enqueue(new TextEncoder().encode(data));
            },
            end: () => {
              controller.close();
            },
            on: (event: string, callback: () => void) => {
              if (event === "close") {
                // Handle close event
              }
            },
          };

          const transport = new SSEServerTransport("/message", responseWrapper as any);
          
          // Store transport by session ID
          transports.set(transport.sessionId, transport);

          // Connect server to transport (this also calls start())
          server.connect(transport).catch((error) => {
            console.error("Error connecting transport:", error);
            controller.close();
          });
        },
        cancel() {
          // Cleanup on client disconnect
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Message endpoint (POST request)
    if (url.pathname === "/message" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      
      if (!sessionId) {
        return new Response("Missing sessionId", { status: 400 });
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        return new Response("Session not found", { status: 404 });
      }

      try {
        const body = await req.json();
        
        // Create request wrapper for transport
        const reqWrapper = {
          headers: Object.fromEntries(req.headers.entries()),
        };

        // Create response wrapper
        let statusCode = 200;
        let responseBody = "";
        const resWrapper = {
          writeHead: (status: number) => {
            statusCode = status;
            return resWrapper;
          },
          end: (data?: string) => {
            if (data) responseBody = data;
          },
        };

        await transport.handlePostMessage(reqWrapper as any, resWrapper as any, body);
        
        return new Response(responseBody || "Accepted", { 
          status: statusCode,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("Error handling message:", error);
        return new Response(
          error instanceof Error ? error.message : "Internal error",
          { status: 500 }
        );
      }
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  }, { port, hostname: host });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  Deno.exit(1);
});
