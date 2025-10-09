#!/usr/bin/env node

const MCPProtocolHandler = require('./mcp-protocol');
const configManager = require('./config/config-manager');
const logger = require('./utils/logger');

// Check if we should run in MCP Server mode (when stdin is not a TTY or when explicitly requested)
const args = process.argv.slice(2);
const isCLIExplicit = args.includes('--cli');
const isMCPMode = !process.stdin.isTTY && !isCLIExplicit;

function showUsage() {
  console.log('Usage:');
  console.log('  # MCP Server mode (automatic when stdin is not a TTY):');
  console.log('  echo \'{"jsonrpc":"2.0","method":"notify","params":{"message":"Test"},"id":1}\' | node index.js');
  console.log('');
  console.log('  # CLI mode:');
  console.log('  node index.js --cli notify --message "Hello World" --channel slack');
  console.log('  node index.js --cli health');
  console.log('  node index.js --cli config');
  console.log('');
  console.log('Options:');
  console.log('  --cli           Run in CLI mode');
  console.log('  --message       Notification message (for notify command)');
  console.log('  --title         Notification title (for notify command)');
  console.log('  --channel       Notification channel (for notify command)');
  console.log('');
  console.log('Examples:');
  console.log('  # Send notification via CLI');
  console.log('  node index.js --cli notify --message "Task completed" --title "AI Notification"');
  console.log('');
  console.log('  # Check health via CLI');
  console.log('  node index.js --cli health');
}

function parseCLIArgs() {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cli') {
      options.cli = true;
    } else if (args[i] === '--message') {
      options.message = args[i + 1];
      i++;
    } else if (args[i] === '--title') {
      options.title = args[i + 1];
      i++;
    } else if (args[i] === '--channel') {
      options.channel = args[i + 1];
      i++;
    } else if (args[i] !== '--cli') {
      options.command = args[i];
    }
  }
  
  return options;
}

async function runCLIMode() {
  const options = parseCLIArgs();
  const command = options.command || 'notify';
  
  try {
    switch (command) {
      case 'notify':
        if (!options.message) {
          console.error('Error: --message is required for notify command');
          showUsage();
          process.exit(1);
        }
        
        // Simulate MCP notification request
        const params = {
          message: options.message,
          title: options.title || '',
          channels: options.channel ? [options.channel] : []
        };
        
        const handler = new MCPProtocolHandler();
        const result = await handler.handleNotifyRequest(params);
        console.log(JSON.stringify(result, null, 2));
        break;
        
      case 'health':
        const healthHandler = new MCPProtocolHandler();
        const healthResult = healthHandler.handleHealthRequest();
        console.log(JSON.stringify(healthResult, null, 2));
        break;
        
      case 'config':
        const configHandler = new MCPProtocolHandler();
        const configResult = configHandler.handleConfigRequest();
        console.log(JSON.stringify(configResult, null, 2));
        break;
        
      default:
        console.error(`Error: Unknown command "${command}"`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Main execution
if (isMCPMode) {
  // MCP Server Mode
  logger.info('Starting MCP Server mode');
  const mcpHandler = new MCPProtocolHandler();
  mcpHandler.initialize();
} else if (isCLIExplicit) {
  // CLI Mode
  logger.info('Starting CLI mode');
  runCLIMode();
} else {
  // Show usage if no mode is specified
  showUsage();
}