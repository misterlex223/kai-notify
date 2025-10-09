const readline = require('readline');
const { spawn } = require('child_process');
const SlackAdapter = require('./adapters/slack-adapter');
const LineAdapter = require('./adapters/line-adapter');
const logger = require('./utils/logger');
const configManager = require('./config/config-manager');

class MCPProtocolHandler {
  constructor() {
    this.slackAdapter = new SlackAdapter();
    this.lineAdapter = new LineAdapter();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  // Initialize the MCP server
  initialize() {
    this.rl.on('line', (input) => {
      if (input.trim()) {
        this.handleInput(input.trim());
      }
    });
    
    // Send initialization response to indicate readiness
    this.sendResponse({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {
          notification: true,
          multiChannel: true
        }
      },
      id: 'init'
    });
  }

  // Handle incoming stdio messages
  handleInput(input) {
    try {
      const message = JSON.parse(input);
      
      if (message.jsonrpc !== '2.0') {
        this.sendError('Invalid JSON-RPC version', -32603);
        return;
      }

      if (message.method) {
        this.handleRequest(message);
      } else if (message.result || message.error) {
        this.handleResponse(message);
      }
    } catch (error) {
      logger.error('Error parsing stdio input', { error: error.message, input });
      this.sendError('Invalid JSON input', -32700);
    }
  }

  // Handle incoming requests
  async handleRequest(request) {
    const { method, params, id } = request;

    logger.info(`Received request: ${method}`, { id, params });

    try {
      let result;

      switch (method) {
        case 'notify':
          result = await this.handleNotifyRequest(params);
          break;
        case 'health':
          result = this.handleHealthRequest(params);
          break;
        case 'config':
          result = this.handleConfigRequest(params);
          break;
        case 'initialize':
          result = { initialized: true };
          break;
        default:
          this.sendError(`Method ${method} not supported`, -32601, id);
          return;
      }

      if (id !== undefined) { // Only respond if it's not a notification
        this.sendResponse({
          jsonrpc: '2.0',
          result: result,
          id: id
        });
      }
    } catch (error) {
      logger.error('Error handling request', { method, error: error.message });
      this.sendError(error.message, -32603, id);
    }
  }

  // Handle responses to our requests
  handleResponse(response) {
    const { id, result, error } = response;
    const requestResolver = this.pendingRequests.get(id);

    if (requestResolver) {
      if (error) {
        requestResolver.reject(error);
      } else {
        requestResolver.resolve(result);
      }
      this.pendingRequests.delete(id);
    }
  }

  // Handle notification requests
  async handleNotifyRequest(params) {
    const { message, channels = [], title = '', priority = 'normal' } = params;

    if (!message) {
      throw new Error('Message is required');
    }

    const results = {
      status: 'success',
      channels_notified: [],
      timestamp: new Date().toISOString(),
      details: {}
    };

    // Determine which channels to send to (all if none specified)
    const targetChannels = channels.length > 0 ? channels : ['slack', 'line'];
    const config = configManager.get();

    // Send notifications to enabled channels
    if (targetChannels.includes('slack') && config.channels.slack.enabled) {
      try {
        await this.slackAdapter.sendMessage(message, title);
        results.channels_notified.push('slack');
        results.details.slack = { status: 'success' };
        logger.info('Slack notification sent successfully');
      } catch (error) {
        logger.error('Error sending Slack notification', { error: error.message });
        results.details.slack = { status: 'error', error: error.message };
      }
    }

    if (targetChannels.includes('line') && config.channels.line.enabled) {
      try {
        await this.lineAdapter.sendMessage(message, title);
        results.channels_notified.push('line');
        results.details.line = { status: 'success' };
        logger.info('LINE notification sent successfully');
      } catch (error) {
        logger.error('Error sending LINE notification', { error: error.message });
        results.details.line = { status: 'error', error: error.message };
      }
    }

    logger.info('Notification processed', { results: results.channels_notified });
    return results;
  }

  // Handle health check requests
  handleHealthRequest(params) {
    const config = configManager.get();
    logger.info('Health check requested');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      channels: {
        slack: config.channels.slack.enabled,
        line: config.channels.line.enabled
      }
    };
  }

  // Handle configuration requests
  handleConfigRequest(params) {
    const config = configManager.get();
    // Don't send sensitive information in response
    const publicConfig = {
      server: config.server,
      channels: {
        slack: { enabled: config.channels.slack.enabled },
        line: { enabled: config.channels.line.enabled }
      }
    };
    return publicConfig;
  }

  // Send response via stdio
  sendResponse(response) {
    const output = JSON.stringify(response) + '\n';
    process.stdout.write(output);
  }

  // Send error response
  sendError(message, code, id) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: code,
        message: message
      },
      id: id
    };
    this.sendResponse(errorResponse);
  }

  // Send a request and wait for response
  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: id
      };

      // Store the resolver to handle the response later
      this.pendingRequests.set(id, { resolve, reject });

      // Send the request
      const output = JSON.stringify(request) + '\n';
      process.stdout.write(output);

      // Clean up after timeout if no response
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }
}

module.exports = MCPProtocolHandler;