import logger from './utils/logger.js';
import configManager from './config/config-manager.js';
import SlackAdapter from './adapters/slack-adapter.js';
import LineAdapter from './adapters/line-adapter.js';
import FeishuAdapter from './adapters/feishu-adapter.js';
import { z } from 'zod';

// Import MCP SDK components using the wildcard path from package exports
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport as StdioTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class MCPServer {
  constructor() {
    this.slackAdapter = new SlackAdapter();
    this.lineAdapter = new LineAdapter();
    this.feishuAdapter = new FeishuAdapter();
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

    // Track server initialization state
    this.initialized = false;
    this.startTime = new Date();
  }

  // Initialize the MCP server using the official SDK
  async initialize() {
    try {
      // Register our notification tool
      this.mcpServer.registerTool('sendNotification', {
        title: 'Send Notification', // Display name for UI
        description: 'Send a notification to configured channels (slack, line, feishu, or multi)',
        inputSchema: {
          channel: z.string().describe('Channel to send notification to (slack, line, feishu, or multi)'),
          message: z.string().describe('Message content to send'),
          title: z.string().optional().describe('Optional title for the notification')
        }
      }, async ({ channel, message, title = '' }) => {
        try {
          // Input validation
          if (!channel || typeof channel !== 'string') {
            return {
              error: {
                code: -32602, // Invalid params
                message: 'Channel parameter is required and must be a string'
              }
            };
          }

          if (!message || typeof message !== 'string') {
            return {
              error: {
                code: -32602, // Invalid params
                message: 'Message parameter is required and must be a string'
              }
            };
          }

          // Log incoming notification request
          logger.info('Processing MCP notification request', { channel, messageLength: message.length });

          let result;

          switch (channel) {
            case 'slack':
              if (!this.config.channels.slack.webhookUrl) {
                logger.warn('Slack notification requested but no webhook URL configured');
                return {
                  error: {
                    code: -32000, // Application specific error
                    message: 'Slack webhook URL not configured'
                  }
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
                logger.warn('LINE notification requested but credentials not configured');
                return {
                  error: {
                    code: -32000, // Application specific error
                    message: 'LINE channel access token or user ID not configured'
                  }
                };
              }
              result = await this.lineAdapter.sendNotification(
                this.config.channels.line.channelAccessToken,
                this.config.channels.line.defaultUserId,
                message
              );
              break;
            case 'feishu':
              if (!this.config.channels.feishu?.enabled || !this.config.channels.feishu.appId || !this.config.channels.feishu.appSecret || !this.config.channels.feishu.defaultUserId) {
                logger.warn('Feishu notification requested but not properly configured');
                return {
                  error: {
                    code: -32000,
                    message: 'Feishu not properly configured (appId, appSecret, and defaultUserId are required)'
                  }
                };
              }
              result = await this.feishuAdapter.sendNotification(
                this.config.channels.feishu.defaultUserId,
                message,
                title
              );
              break;
            case 'multi':
              // Send to both channels if available
              const results = {};

              // Send to Slack if configured
              if (this.config.channels.slack.webhookUrl) {
                try {
                  results.slack = await this.slackAdapter.sendNotification(
                    this.config.channels.slack.webhookUrl,
                    message,
                    title
                  );
                } catch (slackError) {
                  logger.error('Error sending to Slack in multi-channel mode', { error: slackError.message });
                }
              }

              // Send to LINE if configured
              if (this.config.channels.line.channelAccessToken && this.config.channels.line.defaultUserId) {
                try {
                  results.line = await this.lineAdapter.sendNotification(
                    this.config.channels.line.channelAccessToken,
                    this.config.channels.line.defaultUserId,
                    message
                  );
                } catch (lineError) {
                  logger.error('Error sending to LINE in multi-channel mode', { error: lineError.message });
                }
              }

              // Send to Feishu if configured
              if (this.config.channels.feishu?.enabled && this.config.channels.feishu.appId && this.config.channels.feishu.appSecret && this.config.channels.feishu.defaultUserId) {
                try {
                  results.feishu = await this.feishuAdapter.sendNotification(
                    this.config.channels.feishu.defaultUserId,
                    message,
                    title
                  );
                } catch (feishuError) {
                  logger.error('Error sending to Feishu in multi-channel mode', { error: feishuError.message });
                }
              }

              // Check if at least one channel was configured and sent
              if (Object.keys(results).length === 0) {
                return {
                  error: {
                    code: -32000, // Application specific error
                    message: 'No channels configured for multi-channel notification'
                  }
                };
              }

              result = {
                ...results,
                message: `Notification sent to ${Object.keys(results).join(', ')}`
              };
              break;
            default:
              logger.warn('Unsupported channel requested', { channel });
              return {
                error: {
                  code: -32601, // Method not found
                  message: `Unsupported channel: ${channel}. Supported channels: slack, line, feishu, multi`
                }
              };
          }

          // Mark as initialized after first successful request
          if (!this.initialized) {
            this.initialized = true;
          }

          logger.info('Notification sent successfully', { channel, result: result.message });

          return {
            result: {
              success: true,
              channel,
              message: result.message || 'Notification sent successfully',
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          logger.error('Error in MCP sendNotification tool', {
            error: error.message,
            stack: error.stack,
            channel
          });

          return {
            error: {
              code: -32603, // Internal error
              message: `Internal server error: ${error.message}`
            }
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

      // Register a health check tool for server monitoring
      this.mcpServer.registerTool('server/health', {
        title: 'Server Health Check',
        description: 'Check the health status of the notification server',
        inputSchema: {}
      }, async () => {
        try {
          return {
            result: {
              status: 'healthy',
              uptime: new Date().getTime() - this.startTime.getTime(),
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              initialized: this.initialized
            }
          };
        } catch (error) {
          return {
            error: {
              code: -32603, // Internal error
              message: error.message
            }
          };
        }
      });

      // Create transport for stdio communication
      const transport = new StdioTransport(process.stdin, process.stdout);

      // Connect the server to the transport
      await this.mcpServer.connect(transport);

      logger.info('MCP Server initialized and running with SDK', {
        serverName: 'kai-notify',
        version: '1.0.0',
        startTime: this.startTime.toISOString()
      });

    } catch (error) {
      logger.error('Error initializing MCP server with SDK', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  // CLI compatibility methods
  async handleNotifyRequest(params) {
    try {
      // Input validation for CLI mode
      const { message, title, channels = ['multi'] } = params;

      if (!message || typeof message !== 'string') {
        return {
          success: false,
          error: 'Message parameter is required and must be a string'
        };
      }

      if (!Array.isArray(channels)) {
        return {
          success: false,
          error: 'Channels parameter must be an array'
        };
      }

      let result = {};

      for (const channel of channels) {
        switch (channel) {
          case 'slack':
            if (!this.config.channels.slack.webhookUrl) {
              logger.warn('CLI: Slack notification requested but no webhook URL configured');
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
              logger.warn('CLI: LINE notification requested but credentials not configured');
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
          case 'feishu':
            if (!this.config.channels.feishu?.enabled || !this.config.channels.feishu.appId || !this.config.channels.feishu.appSecret || !this.config.channels.feishu.defaultUserId) {
              logger.warn('CLI: Feishu notification requested but not properly configured');
              return {
                success: false,
                error: 'Feishu not properly configured (appId, appSecret, and defaultUserId are required)'
              };
            }
            result.feishu = await this.feishuAdapter.sendNotification(
              this.config.channels.feishu.defaultUserId,
              message,
              title
            );
            break;
          case 'multi':
          default:
            // Send to both channels
            const multiResults = {};

            if (this.config.channels.slack.webhookUrl) {
              try {
                multiResults.slack = await this.slackAdapter.sendNotification(
                  this.config.channels.slack.webhookUrl,
                  message,
                  title
                );
              } catch (slackError) {
                logger.error('CLI: Error sending to Slack in multi-channel mode', { error: slackError.message });
              }
            }

            if (this.config.channels.line.channelAccessToken && this.config.channels.line.defaultUserId) {
              try {
                multiResults.line = await this.lineAdapter.sendNotification(
                  this.config.channels.line.channelAccessToken,
                  this.config.channels.line.defaultUserId,
                  message
                );
              } catch (lineError) {
                logger.error('CLI: Error sending to LINE in multi-channel mode', { error: lineError.message });
              }
            }

            if (this.config.channels.feishu?.enabled && this.config.channels.feishu.appId && this.config.channels.feishu.appSecret && this.config.channels.feishu.defaultUserId) {
              try {
                multiResults.feishu = await this.feishuAdapter.sendNotification(
                  this.config.channels.feishu.defaultUserId,
                  message,
                  title
                );
              } catch (feishuError) {
                logger.error('CLI: Error sending to Feishu in multi-channel mode', { error: feishuError.message });
              }
            }

            // Check if at least one channel was configured and sent
            if (Object.keys(multiResults).length === 0) {
              return {
                success: false,
                error: 'No channels configured for multi-channel notification'
              };
            }

            result = multiResults;
            result.message = `Notification sent to ${Object.keys(multiResults).join(', ')}`;
            break;
        }
      }

      logger.info('CLI notification sent successfully', { channels, result: result.message });

      return {
        success: true,
        result,
        message: 'Notification sent successfully'
      };
    } catch (error) {
      logger.error('Error in handleNotifyRequest:', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  handleHealthRequest() {
    try {
      return {
        success: true,
        status: 'healthy',
        uptime: new Date().getTime() - this.startTime.getTime(),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        initialized: this.initialized
      };
    } catch (error) {
      logger.error('Error in handleHealthRequest:', { error: error.message });
      return {
        success: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  handleConfigRequest() {
    try {
      // Return configuration info without sensitive data
      const { slack, line, feishu } = this.config.channels;
      return {
        success: true,
        config: {
          hasSlackConfig: !!slack.webhookUrl,
          hasLineConfig: !!(line.channelAccessToken && line.defaultUserId),
          hasFeishuConfig: !!(feishu?.appId && feishu?.appSecret && feishu?.defaultUserId),
          channels: ['slack', 'line', 'feishu', 'multi'],
          initialized: this.initialized,
          uptime: new Date().getTime() - this.startTime.getTime()
        }
      };
    } catch (error) {
      logger.error('Error in handleConfigRequest:', { error: error.message });
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}