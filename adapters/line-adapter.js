const line = require('@line/bot-sdk');
const configManager = require('../config/config-manager');

class LineAdapter {
  constructor() {
    const config = configManager.get();
    this.enabled = config.channels.line.enabled;
    
    if (this.enabled) {
      const clientConfig = {
        channelAccessToken: config.channels.line.channelAccessToken,
        channelSecret: config.channels.line.channelSecret
      };
      
      this.client = new line.Client(clientConfig);
      this.botConfig = clientConfig;
      this.defaultUserId = config.channels.line.defaultUserId;
    }
  }

  async sendMessage(message, title = '') {
    if (!this.enabled) {
      throw new Error('LINE adapter is not enabled');
    }

    try {
      // Format the message
      const fullMessage = title ? `${title}\n${message}` : message;
      
      // Create the message object for LINE
      const lineMessage = {
        type: 'text',
        text: fullMessage.substring(0, 5000) // LINE has text limits
      };

      // Send to the default user ID specified in config
      await this.client.pushMessage(this.defaultUserId, lineMessage);
    } catch (error) {
      console.error('Error sending LINE message:', error);
      throw error;
    }
  }
}

module.exports = LineAdapter;