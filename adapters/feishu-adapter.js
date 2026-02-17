import * as Feishu from '@larksuiteoapi/node-sdk';
import configManager from '../config/config-manager.js';

class FeishuAdapter {
  constructor() {
    const config = configManager.get();
    this.enabled = config.channels.feishu?.enabled || false;

    if (this.enabled) {
      this.appId = config.channels.feishu.appId;
      this.appSecret = config.channels.feishu.appSecret;
      this.defaultUserId = config.channels.feishu.defaultUserId;

      // Initialize Feishu client
      this.client = new Feishu.Client({
        appId: this.appId,
        appSecret: this.appSecret,
      });
    }
  }

  async sendNotification(userId, message, title = '') {
    try {
      if (!this.enabled) {
        throw new Error('Feishu channel is not enabled');
      }

      if (!userId) {
        userId = this.defaultUserId;
      }

      if (!userId) {
        throw new Error('No user ID provided for Feishu notification');
      }

      // Build message content
      const text = title ? `${title}\n${message}` : message;

      // Send message via Feishu API
      const response = await this.client.im.message.create({
        params: {
          receive_id_type: 'open_id',
        },
        data: {
          receive_id: userId,
          msg_type: 'text',
          content: JSON.stringify({ text: text }),
        },
      });

      if (response.code !== 0) {
        throw new Error(`Feishu API error: ${response.msg} (code: ${response.code})`);
      }

      return {
        success: true,
        data: response.data,
        message: 'Feishu notification sent successfully'
      };
    } catch (error) {
      console.error('Error sending Feishu notification:', error);
      throw error;
    }
  }
}

export default FeishuAdapter;
