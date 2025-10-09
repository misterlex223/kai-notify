# Notification Hub - Requirements and Specifications

## Project Overview
Notification Hub (kai-notify) is a local MCP (Managed Compute Platform) server that serves as a centralized notification system. It receives notifications from AI services via stdio communication and distributes them across multiple channels, currently supporting Slack and LINE Official Account (OA). The server operates without requiring network ports, making it suitable for local execution with multiple instances running simultaneously. The system supports npx execution for easy access without installation.

## Requirements

### Functional Requirements
1. **Multi-Channel Notification Distribution**: Support sending notifications to multiple channels (Slack, LINE OA)
2. **MCP Protocol Compliance**: Accept notifications via MCP-compatible endpoints
3. **Channel Configuration**: Allow separate configuration for each notification channel
4. **Message Formatting**: Format messages appropriately for each channel
5. **Error Handling**: Handle errors gracefully and provide logging
6. **Local Execution**: Run as a local service without requiring cloud deployment

### Non-Functional Requirements
1. **Reliability**: Ensure notifications are delivered reliably
2. **Scalability**: Support adding new notification channels easily
3. **Security**: Secure handling of API tokens and credentials
4. **Performance**: Fast notification delivery with minimal latency

## System Architecture

### Components
1. **Stdio Protocol Handler**: Receives and sends JSON-RPC formatted messages via stdin/stdout for MCP communication
2. **Notification Router**: Determines which channels to send notifications to
3. **Channel Adapters**: Individual modules for each notification channel (Slack, LINE)
4. **Configuration Manager**: Handles configuration for all channels
5. **Error Handler and Logger**: Manages errors and logs activities
6. **MCP Tools and Prompts Handler**: Provides MCP-standard tools and prompts discovery and execution

### Data Flow
1. AI service sends notification request via stdio to the Notification Hub
2. Stdio Protocol Handler receives and parses the JSON-RPC message
3. Notification Hub validates the request
4. Router determines target channels based on configuration
5. Each channel adapter formats and sends the message
6. Response is sent back to the AI service via stdout in JSON-RPC format

## Communication Protocol

### Stdio Communication
The Notification Hub communicates via stdin/stdout using JSON-RPC 2.0 protocol for MCP compliance. The server can operate in two modes:

1. **MCP Server Mode**: Explicitly activated with `--mcp` flag for persistent stdio communication
2. **CLI Mode**: Activated with `--cli` flag for manual testing and single requests

### MCP Requests via Stdio
- **Protocol**: JSON-RPC 2.0 over stdin/stdout
- **Request Format**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "notify",
    "params": {
      "message": "Notification content",
      "channels": ["slack", "line"], // Optional - defaults to all configured channels
      "title": "Optional title",
      "priority": "normal" // Optional - for future priority handling
    }
  }
  ```

### MCP Responses via Stdio
- **Success Response**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "status": "success",
      "channels_notified": ["slack", "line"],
      "timestamp": "ISO 8601 timestamp"
    }
  }
  ```

- **Error Response**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
      "code": -32600, // Standard JSON-RPC error code
      "message": "Error description"
    }
  }
  ```

### MCP Tools and Prompts Support
The system now supports MCP-standard tools and prompts:
- **Tools**:
  - `tools/list`: Discover available tools
  - `tools/call`: Execute specific tools (e.g., send_notification)
- **Prompts**:
  - `prompts/list`: Discover available prompt templates
  - `prompts/get`: Retrieve specific prompt details

### CLI Mode Commands
- **Health Check**: `npx kai-notify --cli health`
- **Notification**: `npx kai-notify --cli notify --message "Your message" --channel slack`
- **MCP Server Mode**: `npx kai-notify --mcp` (persistent communication)
- **MCP Request**: `echo '{"jsonrpc":"2.0","method":"notify","params":{"message":"Test"},"id":1}' | npx kai-notify --mcp`

### Configuration Priority
The system looks for configuration in this order:
1. `.kai-notify.json` in the current working directory
2. `~/.kai/notify.json` in the user's home directory
3. `config/config.json` in the project directory (fallback)

## Channel Integration Specifications

### Slack Integration
- **Authentication**: Slack Bot Token or Webhook URL
- **API**: Slack Web API or Incoming Webhooks
- **Message Format**: 
  - Text messages using `chat.postMessage`
  - Rich messages with attachments if needed

### LINE OA Integration
- **Authentication**: Channel Access Token and Channel Secret
- **API**: LINE Messaging API
- **Message Format**: 
  - Text messages
  - Rich messages with templates if needed

## Configuration

### Configuration File Format
The system supports multiple configuration file locations with the following priority:
1. `.kai-notify.json` in the current working directory
2. `~/.kai/notify.json` in the user's home directory  
3. `config/config.json` in the project directory (fallback)

All configuration files use the same format:
```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "webhookUrl": "https://hooks.slack.com/services/...",
      "defaultChannel": "#general"
    },
    "line": {
      "enabled": true,
      "channelAccessToken": "YOUR_CHANNEL_ACCESS_TOKEN",
      "channelSecret": "YOUR_CHANNEL_SECRET",
      "defaultUserId": "USER_ID"
    }
  }
}
```

## Security Considerations
- Store API tokens and credentials securely (not in code)
- Since communication happens via stdio, network-based attacks are mitigated
- Validate all input to prevent injection attacks
- Ensure proper file permissions on configuration files containing credentials

## npx Support
- **Easy Access**: The system can be run directly with npx without requiring installation
- **Global Availability**: Accessible from any directory without local installation
- **Version Management**: npx automatically handles version updates
- **Isolated Execution**: No global dependencies to manage
- **MCP Server Mode**: Run with `npx kai-notify --mcp` for persistent communication
- **CLI Mode**: Run with `npx kai-notify --cli` for single requests

## Benefits of Stdio Protocol
- **No Network Ports Required**: The server operates without occupying network ports, allowing multiple instances to run simultaneously
- **Enhanced Security**: Communication happens via stdio, eliminating network-based vulnerabilities
- **MCP Compliance**: Fully compatible with MCP standards using JSON-RPC protocol
- **Resource Efficient**: Lower overhead compared to HTTP-based servers
- **Local Execution**: Optimized for local execution environments

## Future Enhancements
- Additional notification channels (Email, Discord, etc.)
- Message templating
- Priority-based notifications
- Delivery receipts and confirmation
- Rate limiting