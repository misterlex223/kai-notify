import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, 'logs');
    this.logFile = path.join(this.logDir, `notification-hub-${new Date().toISOString().split('T')[0]}.log`);
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    // Write to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

    // Output to console using stderr for MCP compliance
    // Only protocol messages should go through stdout
    console.error(`${timestamp} [${level}] ${message}`, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }
}

export default new Logger();