const { WebClient } = require('@slack/web-api');
const configManager = require('../config/config-manager');

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

  async sendMessage(message, title = '') {
    if (!this.enabled) {
      throw new Error('Slack adapter is not enabled');
    }

    try {
      if (this.botToken) {
        // Use bot token to post message
        const response = await this.client.chat.postMessage({
          channel: this.defaultChannel,
          text: title ? `${title}\n${message}` : message,
          mrkdwn: true
        });

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.error}`);
        }
      } else if (this.webhookUrl) {
        // Use webhook to post message
        const axios = require('axios');
        
        const payload = {
          text: title ? `${title}\n${message}` : message,
          channel: this.defaultChannel
        };

        await axios.post(this.webhookUrl, payload);
      } else {
        throw new Error('No valid authentication method configured for Slack');
      }
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }
}

module.exports = SlackAdapter;