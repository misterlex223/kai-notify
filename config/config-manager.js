const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    // Priority order:
    // 1. .kai-notify.json in current working directory
    // 2. ~/.kai/notify.json in user's home directory
    // 3. Default config file in project directory
    
    const workingDirConfig = path.join(process.cwd(), '.kai-notify.json');
    const userHomeConfig = path.join(os.homedir(), '.kai', 'notify.json');
    const defaultConfig = path.join(__dirname, 'config.json');
    
    // Try working directory config first
    if (fs.existsSync(workingDirConfig)) {
      console.log(`Loading config from: ${workingDirConfig}`);
      try {
        const rawData = fs.readFileSync(workingDirConfig, 'utf8');
        return JSON.parse(rawData);
      } catch (error) {
        console.error(`Error loading working directory config: ${error.message}`);
      }
    }
    
    // Try user home config next
    if (fs.existsSync(userHomeConfig)) {
      console.log(`Loading config from: ${userHomeConfig}`);
      try {
        const rawData = fs.readFileSync(userHomeConfig, 'utf8');
        return JSON.parse(rawData);
      } catch (error) {
        console.error(`Error loading user home config: ${error.message}`);
      }
    }
    
    // Fallback to default config
    console.log(`Loading config from: ${defaultConfig}`);
    try {
      const rawData = fs.readFileSync(defaultConfig, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading configuration:', error.message);
      // Return default config if loading fails
      return {
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