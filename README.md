# kai-notify

A stdio-based MCP (Managed Compute Platform) server that serves as a centralized notification system. It receives notifications from AI services via stdio communication and distributes them across multiple channels, currently supporting Slack, LINE Official Account (OA), and Feishu. The server operates without requiring network ports, making it suitable for local execution with multiple instances running simultaneously.

## Features

- **Stdio Protocol**: Communicates via stdin/stdout using JSON-RPC 2.0 protocol for MCP compliance
- **Multiple Modes**: Operates in both MCP Server Mode and CLI Mode
- **Multi-Channel Support**: Send notifications to Slack, LINE, and Feishu
- **Flexible Configuration**: Supports multiple configuration file locations
- **npx Support**: Can be run directly with npx without installation

## Installation

You don't need to install kai-notify. It can be run directly with npx:

```bash
npx kai-notify
```

## Configuration Priority

The system looks for configuration in this order:

1. `.kai-notify.json` in the current working directory
2. `~/.kai/notify.json` in the user's home directory
3. `config/config.json` in the project directory (fallback)

## Configuration File Format

Create a `.kai-notify.json` file in your working directory:

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-your-token",
      "webhookUrl": "https://hooks.slack.com/services/your/webhook",
      "defaultChannel": "#general"
    },
    "line": {
      "enabled": true,
      "channelAccessToken": "your-channel-access-token",
      "channelSecret": "your-channel-secret",
      "defaultUserId": "user-id-to-send-to"
    },
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxx",
      "appSecret": "your-app-secret",
      "defaultUserId": "ou_xxxxxxxxx"
    }
  }
}
```

## Usage

### MCP Server Mode (when stdin is piped)

```bash
echo '{"jsonrpc":"2.0","method":"notify","params":{"message":"Test"},"id":1}' | npx kai-notify
```

### CLI Mode

```bash
# Send a notification
npx kai-notify --cli notify --message "Hello World" --channel line

# Check health
npx kai-notify --cli health

# View configuration
npx kai-notify --cli config
```

### CLI Options

- `--cli`: Run in CLI mode
- `--message`: Notification message (for notify command)
- `--title`: Notification title (for notify command)
- `--channel`: Notification channel (for notify command) - slack, line, feishu, or multi

## Examples

```bash
# Send a notification to LINE
npx kai-notify --cli notify --message "Task completed successfully" --title "Notification" --channel line

# Send a notification to Slack
npx kai-notify --cli notify --message "Build finished" --channel slack

# Send a notification to Feishu
npx kai-notify --cli notify --message "Task completed successfully" --channel feishu

# Send notification without specifying channel (sends to all enabled channels)
npx kai-notify --cli notify --message "System alert"
```

## Benefits of Stdio Protocol

- **No Network Ports Required**: The server operates without occupying network ports, allowing multiple instances to run simultaneously
- **Enhanced Security**: Communication happens via stdio, eliminating network-based vulnerabilities
- **MCP Compliance**: Fully compatible with MCP standards using JSON-RPC protocol
- **Resource Efficient**: Lower overhead compared to HTTP-based servers
- **Local Execution**: Optimized for local execution environments