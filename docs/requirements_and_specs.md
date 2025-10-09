# Notification Hub - Requirements and Specifications

## Project Overview
Notification Hub is a local MCP (Managed Compute Platform) server that serves as a centralized notification system. It receives notifications from AI services and distributes them across multiple channels, currently supporting Slack and LINE Official Account (OA).

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
1. **MCP Endpoint Handler**: Receives notification requests from AI services
2. **Notification Router**: Determines which channels to send notifications to
3. **Channel Adapters**: Individual modules for each notification channel (Slack, LINE)
4. **Configuration Manager**: Handles configuration for all channels
5. **Error Handler and Logger**: Manages errors and logs activities

### Data Flow
1. AI service sends notification to MCP endpoint
2. Notification Hub receives and validates the request
3. Router determines target channels based on configuration
4. Each channel adapter formats and sends the message
5. Status is logged and returned to the AI service

## API Specifications

### MCP Endpoint
- **Method**: POST
- **Path**: `/notify`
- **Content-Type**: application/json
- **Request Body**:
  ```json
  {
    "message": "Notification content",
    "channels": ["slack", "line"], // Optional - defaults to all configured channels
    "title": "Optional title",
    "priority": "normal" // Optional - for future priority handling
  }
  ```

### Response
- **Success**:
  ```json
  {
    "status": "success",
    "channels_notified": ["slack", "line"],
    "timestamp": "ISO 8601 timestamp"
  }
  ```
- **Error**:
  ```json
  {
    "status": "error",
    "error": "Error description",
    "timestamp": "ISO 8601 timestamp"
  }
  ```

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

### Configuration File Format (config.json)
```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
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
- Optionally implement request authentication for the MCP endpoint
- Validate all input to prevent injection attacks

## Future Enhancements
- Additional notification channels (Email, Discord, etc.)
- Message templating
- Priority-based notifications
- Delivery receipts and confirmation
- Rate limiting