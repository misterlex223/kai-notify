const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const rawData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading configuration:', error.message);
      // Return default config if loading fails
      return {
        "server": {
          "port": 3000,
          "host": "localhost"
        },
        "channels": {
          "slack": {
            "enabled": false,
            "botToken": "",
            "webhookUrl": "",
            "defaultChannel": "#general"
          },
          "line": {
            "enabled": false,
            "channelAccessToken": "",
            "channelSecret": "",
            "defaultUserId": ""
          }
        }
      };
    }
  }

  updateConfig(newConfig) {
    try {
      // Validate the new configuration
      this.validateConfig(newConfig);
      
      // Update the in-memory config
      this.config = { ...this.config, ...newConfig };
      
      // Write to file
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      
      return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  validateConfig(config) {
    // Basic validation for required structure
    if (!config.server || !config.channels) {
      throw new Error('Invalid configuration structure');
    }
    
    // Validate server config
    if (typeof config.server.port !== 'number' || config.server.port <= 0) {
      throw new Error('Server port must be a positive number');
    }
    
    // Validate channel configs
    if (config.channels.slack) {
      if (typeof config.channels.slack.enabled !== 'boolean') {
        throw new Error('Slack enabled must be a boolean');
      }
    }
    
    if (config.channels.line) {
      if (typeof config.channels.line.enabled !== 'boolean') {
        throw new Error('LINE enabled must be a boolean');
      }
    }
    
    return true;
  }

  get() {
    return this.config;
  }

  getChannelConfig(channelName) {
    if (!this.config.channels[channelName]) {
      throw new Error(`Channel ${channelName} not found in configuration`);
    }
    return this.config.channels[channelName];
  }

  updateChannelConfig(channelName, channelConfig) {
    if (!this.config.channels[channelName]) {
      throw new Error(`Channel ${channelName} not found in configuration`);
    }
    
    const updatedConfig = {
      ...this.config,
      channels: {
        ...this.config.channels,
        [channelName]: {
          ...this.config.channels[channelName],
          ...channelConfig
        }
      }
    };
    
    return this.updateConfig(updatedConfig);
  }
}

module.exports = new ConfigManager();