import readline from 'readline';
import { spawn } from 'child_process';
import logger from './utils/logger.js';
import configManager from './config/config-manager.js';
import SlackAdapter from './adapters/slack-adapter.js';
import LineAdapter from './adapters/line-adapter.js';
import { z } from 'zod';

// Import MCP SDK components using the wildcard path from package exports
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport as StdioTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

export class MCPServer {
  constructor() {
    this.slackAdapter = new SlackAdapter();
    this.lineAdapter = new LineAdapter();
    this.config = configManager.get();
    
    // Create the MCP server with proper server info
    this.mcpServer = new McpServer({
      name: 'kai-notify',
      version: '1.0.0',
      websiteUrl: 'https://github.com/kai-notify',
      description: 'A multi-channel notification hub for AI task completion alerts'
    }, {
      capabilities: {
        tools: {},
        prompts: {}
      }
    });
  }

  // Initialize the MCP server using the official SDK
  async initialize() {
    try {
      // Register our notification tool
      this.mcpServer.registerTool('sendNotification', {
        title: 'Send Notification', // Display name for UI
        description: 'Send a notification to configured channels',
        inputSchema: {
          channel: z.string().describe('Channel to send notification to (slack, line, or multi)'),
          message: z.string().describe('Message content to send'),
          title: z.string().optional().describe('Optional title for the notification')
        }
      }, async ({ channel, message, title = '' }) => {
        try {
          let result;
          
          switch (channel) {
            case 'slack':
              if (!this.config.channels.slack.webhookUrl) {
                return {
                  content: [{ type: 'text', text: 'Error: Slack webhook URL not configured' }]
                };
              }
              result = await this.slackAdapter.sendNotification(
                this.config.channels.slack.webhookUrl,
                message,
                title
              );
              break;
            case 'line':
              if (!this.config.channels.line.channelAccessToken || !this.config.channels.line.defaultUserId) {
                return {
                  content: [{ type: 'text', text: 'Error: LINE channel access token or user ID not configured' }]
                };
              }
              result = await this.lineAdapter.sendNotification(
                this.config.channels.line.channelAccessToken,
                this.config.channels.line.defaultUserId,
                message
              );
              break;
            case 'multi':
              // Send to both channels
              if (!this.config.channels.slack.webhookUrl) {
                return {
                  content: [{ type: 'text', text: 'Error: Slack webhook URL not configured' }]
                };
              }
              const slackResult = await this.slackAdapter.sendNotification(
                this.config.channels.slack.webhookUrl,
                message,
                title
              );
              
              if (!this.config.channels.line.channelAccessToken || !this.config.channels.line.defaultUserId) {
                return {
                  content: [{ type: 'text', text: 'Error: LINE channel access token or user ID not configured' }]
                };
              }
              const lineResult = await this.lineAdapter.sendNotification(
                this.config.channels.line.channelAccessToken,
                this.config.channels.line.defaultUserId,
                message
              );
              
              result = {
                slack: slackResult,
                line: lineResult,
                message: 'Notification sent to multiple channels'
              };
              break;
            default:
              throw new Error(`Unsupported channel: ${channel}`);
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Successfully sent notification: ${JSON.stringify(result)}`
              }
            ]
          };
        } catch (error) {
          logger.error('Error sending notification', { error: error.message });
          
          return {
            content: [
              {
                type: 'text',
                text: `Error sending notification: ${error.message}`
              }
            ]
          };
        }
      });
      
      // Register a prompt that guides the AI on using the sendNotification tool
      this.mcpServer.registerPrompt('sendNotification', {
        title: 'Send Notification Tool Guide',
        description: 'Use this prompt when you need to send notifications to users via various channels. It provides guidance on how to use the sendNotification tool.',
        argsSchema: {
          task: z.string().describe('Description of the task or event that requires a notification')
        }
      }, async ({ task }) => {
        // This prompt helps guide the AI on when and how to use the sendNotification tool
        return {
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: `You can send notifications to users using the sendNotification tool when important events occur, such as: task completion, status updates, errors, or other significant system events.`
              }
            },
            {
              role: 'user', 
              content: {
                type: 'text',
                text: `When I need to notify users about: ${task}, I should use the sendNotification tool.`
              }
            },
            {
              role: 'assistant',
              content: {
                type: 'text',
                text: `Use the sendNotification tool to send notifications about: ${task}. Choose the appropriate channel (slack, line, or multi) based on your configuration and user preferences.`
              }
            }
          ]
        };
      });
      
      // Create transport for stdio communication
      const transport = new StdioTransport(process.stdin, process.stdout);
      
      // Connect the server to the transport
      await this.mcpServer.connect(transport);
      
      logger.info('MCP Server initialized and running with SDK');
      
    } catch (error) {
      logger.error('Error initializing MCP server with SDK', { error: error.message });
      throw error;
    }
  }
  
  // CLI compatibility methods
  async handleNotifyRequest(params) {
    try {
      const { message, title, channels = ['multi'] } = params;
      
      let result = {};
      
      for (const channel of channels) {
        switch (channel) {
          case 'slack':
            if (!this.config.channels.slack.webhookUrl) {
              return {
                success: false,
                error: 'Slack webhook URL not configured'
              };
            }
            result.slack = await this.slackAdapter.sendNotification(
              this.config.channels.slack.webhookUrl,
              message,
              title
            );
            break;
          case 'line':
            if (!this.config.channels.line.channelAccessToken || !this.config.channels.line.defaultUserId) {
              return {
                success: false,
                error: 'LINE channel access token or user ID not configured'
              };
            }
            result.line = await this.lineAdapter.sendNotification(
              this.config.channels.line.channelAccessToken,
              this.config.channels.line.defaultUserId,
              message
            );
            break;
          case 'multi':
          default:
            // Send to both channels
            if (!this.config.channels.slack.webhookUrl) {
              return {
                success: false,
                error: 'Slack webhook URL not configured'
              };
            }
            result.slack = await this.slackAdapter.sendNotification(
              this.config.channels.slack.webhookUrl,
              message,
              title
            );
            
            if (!this.config.channels.line.channelAccessToken || !this.config.channels.line.defaultUserId) {
              return {
                success: false,
                error: 'LINE channel access token or user ID not configured'
              };
            }
            result.line = await this.lineAdapter.sendNotification(
              this.config.channels.line.channelAccessToken,
              this.config.channels.line.defaultUserId,
              message
            );
            result.message = 'Notification sent to multiple channels';
            break;
        }
      }
      
      return {
        success: true,
        result,
        message: 'Notification sent successfully'
      };
    } catch (error) {
      logger.error('Error in handleNotifyRequest:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  handleHealthRequest() {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
  
  handleConfigRequest() {
    // Return configuration info without sensitive data
    const { slack, line } = this.config.channels;
    return {
      success: true,
      config: {
        hasSlackConfig: !!slack.webhookUrl,
        hasLineConfig: !!(line.channelAccessToken && line.defaultUserId),
        channels: ['slack', 'line', 'multi']
      }
    };
  }
}