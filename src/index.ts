#!/usr/bin/env -S deno run --allow-all

/**
 * Signal MCP Server
 * 
 * An MCP server that provides tools for interacting with Signal messenger
 * via signal-cli.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SignalCLI } from "./signal-cli.ts";

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
 * Tool: receive_messages
 * Get new messages from Signal
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "receive_messages",
        description:
          "Receive new messages from Signal. Returns an array of message objects with sender, timestamp, body, and attachments.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of messages to return (optional)",
              minimum: 1,
            },
            since: {
              type: "number",
              description:
                "Unix timestamp - only return messages after this time (optional)",
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
      case "receive_messages": {
        const limit = args?.limit as number | undefined;
        const since = args?.since as number | undefined;

        const messages = await signalCli.receiveMessages(limit, since);

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
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Signal MCP Server running on stdio");
  console.error(`Account: ${signalAccount}`);
  console.error(`Signal CLI path: ${signalCliPath}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  Deno.exit(1);
});
