import { WebClient } from '@slack/web-api';
import configManager from '../config/config-manager.js';
import axios from 'axios';

class SlackAdapter {
  constructor() {
    const config = configManager.get();
    this.enabled = config.channels.slack.enabled;
    
    if (this.enabled) {
      // Use either bot token or webhook URL
      if (config.channels.slack.botToken) {
        this.client = new WebClient(config.channels.slack.botToken);
        this.botToken = config.channels.slack.botToken;
      }
      this.webhookUrl = config.channels.slack.webhookUrl;
      this.defaultChannel = config.channels.slack.defaultChannel;
    }
  }

  async sendNotification(webhookUrl, message, title = '') {
    try {
      if (webhookUrl) {
        // Use the provided webhook URL to post message
        const payload = {
          text: title ? `${title}\n${message}` : message
        };

        const response = await axios.post(webhookUrl, payload);
        return {
          success: true,
          data: response.data,
          message: 'Slack notification sent successfully'
        };
      } else {
        // Fallback to config webhook if not provided
        const config = configManager.get();
        if (config.channels.slack.webhookUrl) {
          const payload = {
            text: title ? `${title}\n${message}` : message
          };

          const response = await axios.post(config.channels.slack.webhookUrl, payload);
          return {
            success: true,
            data: response.data,
            message: 'Slack notification sent successfully'
          };
        } else {
          throw new Error('No valid webhook URL provided for Slack');
        }
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error;
    }
  }
}

export default SlackAdapter;