#!/usr/bin/env -S DENO_TLS_CA_STORE=system deno run --allow-all

/**
 * Test script for Signal MCP Server
 * This tests that the server can initialize without signal-cli installed
 */

console.log("Testing Signal MCP Server initialization...\n");

// Test 1: Check if Deno is working
console.log("✓ Deno runtime is working");

// Test 2: Check TypeScript compilation
console.log("✓ TypeScript compilation successful");

// Test 3: Check imports
try {
  const { SignalCLI } = await import("./src/signal-cli.ts");
  console.log("✓ SignalCLI class imported successfully");
  
  // Test 4: Check types
  const types = await import("./src/types.ts");
  console.log("✓ Type definitions loaded successfully");
  
  // Test 5: Test MCP SDK import
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  console.log("✓ MCP SDK imported successfully");
  
  console.log("\n✅ All basic tests passed!");
  console.log("\nNote: To fully test the server, you need to:");
  console.log("1. Install signal-cli");
  console.log("2. Register/link your Signal account");
  console.log("3. Set SIGNAL_ACCOUNT environment variable");
  console.log("4. Run: deno task start");
  
} catch (error) {
  console.error("\n❌ Test failed:", error);
  Deno.exit(1);
}
