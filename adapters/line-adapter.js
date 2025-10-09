import line from '@line/bot-sdk';
import configManager from '../config/config-manager.js';

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

  async sendNotification(channelAccessToken, userId, message) {
    try {
      // Use the provided access token and user ID
      const client = new line.Client({
        channelAccessToken: channelAccessToken
      });
      
      // Send to the specified user ID
      const response = await client.pushMessage(userId, {
        type: 'text',
        text: message.substring(0, 5000) // LINE has text limits
      });
      
      return {
        success: true,
        data: response,
        message: 'LINE notification sent successfully'
      };
    } catch (error) {
      console.error('Error sending LINE notification:', error);
      throw error;
    }
  }
}

export default LineAdapter;