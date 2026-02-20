# 飛書 Channel 集成實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 kai-notify 專案中新增飛書（Feishu/Lark）通知通道支援，允許透過 MCP 協議或 CLI 發送純文字消息給飛書用戶。

**Architecture:** 遵循現有的 Adapter 模式，創建 FeishuAdapter 類，使用官方 @larksuiteoapi/node-sdk 與飛書 API 通信。整合到現有的 MCP Server 和 CLI 模式中，支援 feishu 和 multi channel 選項。

**Tech Stack:** Node.js ES Modules, @larksuiteoapi/node-sdk, @modelcontextprotocol/sdk, Express

---

## Task 1: 新增 Feishu SDK 依賴

**Files:**
- Modify: `package.json`

**Step 1: 添加 @larksuiteoapi/node-sdk 依賴**

在 `dependencies` 中添加：

```json
"@larksuiteoapi/node-sdk": "^1.29.0"
```

**Step 2: 安裝依賴**

Run: `npm install`

**Step 3: 驗證安裝**

Run: `npm list @larksuiteoapi/node-sdk`
Expected: 顯示已安裝的版本號

**Step 4: 更新 keywords**

在 `package.json` 的 `keywords` 陣列中添加 `"feishu"` 和 `"lark"`：

```json
"keywords": [
  "notification",
  "mcp",
  "slack",
  "line",
  "feishu",
  "lark",
  "ai",
  "alert"
]
```

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Feishu SDK dependency

- Add @larksuiteoapi/node-sdk for Feishu/Lark API integration
- Update keywords to include feishu and lark"
```

---

## Task 2: 創建 FeishuAdapter 類

**Files:**
- Create: `adapters/feishu-adapter.js`

**Step 1: 創建 FeishuAdapter 類骨架**

```javascript
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
      const response = await this.client.message.sendMessage({
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
```

**Step 2: 驗證語法**

Run: `node -c adapters/feishu-adapter.js`
Expected: 無錯誤輸出

**Step 3: Commit**

```bash
git add adapters/feishu-adapter.js
git commit -m "feat: add FeishuAdapter class

- Implement FeishuAdapter using official SDK
- Support sending text messages to Feishu users
- Include error handling for API responses"
```

---

## Task 3: 更新配置管理器支援 Feishu

**Files:**
- Modify: `config/config.json`
- Modify: `config/config-manager.js` (if needed)

**Step 1: 更新 config.json 添加 Feishu 配置示例**

在 `channels` 中添加 feishu 配置：

```json
{
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
    },
    "feishu": {
      "enabled": false,
      "appId": "",
      "appSecret": "",
      "defaultUserId": ""
    }
  }
}
```

**Step 2: 驗證配置結構**

Run: `node -e "import('./config/config-manager.js').then(m => console.log(JSON.stringify(m.get(), null, 2)))"`
Expected: 配置包含 feishu channel

**Step 3: Commit**

```bash
git add config/config.json
git commit -m "feat: add Feishu channel to default config

- Add feishu channel configuration schema
- Include appId, appSecret, and defaultUserId fields"
```

---

## Task 4: 整合 FeishuAdapter 到 MCP Server

**Files:**
- Modify: `mcp-protocol.js`

**Step 1: 導入 FeishuAdapter**

在檔案頂部的 import 區域添加：

```javascript
import FeishuAdapter from './adapters/feishu-adapter.js';
```

**Step 2: 在 MCPServer constructor 中初始化 FeishuAdapter**

找到 constructor 中的 adapter 初始化部分，添加：

```javascript
this.feishuAdapter = new FeishuAdapter();
```

**Step 3: 更新 sendNotification tool 的 inputSchema**

找到 `registerTool('sendNotification', ...)` 中的 inputSchema description，更新：

```javascript
description: 'Send a notification to configured channels (slack, line, feishu, or multi)'
```

**Step 4: 在 sendNotification tool 中添加 feishu case**

在 channel switch 語句中添加 feishu 分支：

```javascript
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
```

**Step 5: 更新 unsupported channel 錯誤消息**

找到 default case 中的錯誤消息，更新：

```javascript
message: `Unsupported channel: ${channel}. Supported channels: slack, line, feishu, multi`
```

**Step 6: 在 multi-channel 模式中添加 Feishu 支援**

找到 `case 'multi':` 中的 channel 迴圈，在 LINE 處理之後添加：

```javascript
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
```

**Step 7: 更新 CLI compatibility method handleNotifyRequest**

找到 CLI 模式中的 switch 語句，添加 feishu 分支：

```javascript
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
```

**Step 8: 更新 CLI multi-channel 模式**

找到 CLI 模式中的 `case 'multi':`，在 LINE 處理之後添加：

```javascript
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
```

**Step 9: 更新 handleConfigRequest 以包含 Feishu 配置檢查**

找到 `handleConfigRequest` 方法，更新：

```javascript
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
```

**Step 10: 驗證語法**

Run: `node -c mcp-protocol.js`
Expected: 無錯誤輸出

**Step 11: Commit**

```bash
git add mcp-protocol.js
git commit -m "feat: integrate FeishuAdapter into MCP Server

- Import and initialize FeishuAdapter
- Add feishu channel to sendNotification tool
- Support feishu in multi-channel mode
- Update CLI mode to support feishu
- Update config endpoint to report Feishu status"
```

---

## Task 5: 更新 README 文檔

**Files:**
- Modify: `README.md`

**Step 1: 更新 Features 區域**

在 Features bullet points 中添加：

```markdown
- **Multi-Channel Support**: Send notifications to Slack, LINE, and Feishu
```

**Step 2: 更新 Configuration File Format 區域**

在配置示例中添加 feishu 配置：

```markdown
```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-your-token",
      "webhookUrl": "https://hooks.slack.com/services/your/webhook",
      "defaultChannel": "#general"
    },
    "line": {
      "enabled": true,
      "channelAccessToken": "your-channel-access-token",
      "channelSecret": "your-channel-secret",
      "defaultUserId": "user-id-to-send-to"
    },
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxx",
      "appSecret": "your-app-secret",
      "defaultUserId": "ou_xxxxxxxxx"
    }
  }
}
```
```

**Step 3: 更新 CLI Examples 區域**

添加 Feishu 示例：

```markdown
# Send a notification to Feishu
npx kai-notify --cli notify --message "Task completed successfully" --channel feishu
```

**Step 4: 更新 CLI Options 描述**

更新 `--channel` 選項描述：

```markdown
- `--channel`: Notification channel (for notify command) - slack, line, feishu, or multi
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for Feishu channel support

- Add Feishu to features list
- Include Feishu configuration example
- Add Feishu CLI usage examples"
```

---

## Task 6: CLI 測試

**Files:**
- (No file changes - testing only)

**Step 1: 檢查配置狀態**

Run: `npx kai-notify --cli config`
Expected: 輸出包含 `hasFeishuConfig: false` 和 `channels: ["slack", "line", "feishu", "multi"]`

**Step 2: 測試健康檢查**

Run: `npx kai-notify --cli health`
Expected: 返回健康狀態 JSON

**Step 3: 創建測試配置文件**

Create: `.kai-notify.json`

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "test_app_id",
      "appSecret": "test_app_secret",
      "defaultUserId": "test_user_id"
    }
  }
}
```

**Step 4: 測試 Feishu 通道（將因無效憑證失敗，但驗證流程）**

Run: `npx kai-notify --cli notify --message "Test message" --channel feishu`
Expected: 錯誤消息指示 API 認證失敗（驗證代碼路徑正確）

**Step 5: 清理測試配置**

Run: `rm .kai-notify.json`

---

## Task 7: 最終驗證和清理

**Files:**
- (No file changes - verification only)

**Step 1: 驗證所有文件語法**

Run: `node -c adapters/feishu-adapter.js && node -c mcp-protocol.js && node -c index.js`
Expected: 無錯誤輸出

**Step 2: 檢查 git 狀態**

Run: `git status`
Expected: 只有未提交的測試文件（如果有），所有更改已提交

**Step 3: 查看提交歷史**

Run: `git log --oneline -5`
Expected: 顯示所有新的提交

**Step 4: 運行現有測試（如果有）**

Run: `npm test` (如果專案有測試)
Expected: 所有現有測試通過

---

## 實作完成後檢查清單

- [ ] @larksuiteoapi/node-sdk 依賴已安裝
- [ ] FeishuAdapter 類已創建並導出
- [ ] config.json 包含 feishu 配置架構
- [ ] MCP Server 支援 feishu channel
- [ ] MCP Server 支援 multi channel 包含 feishu
- [ ] CLI 模式支援 feishu channel
- [ ] CLI 模式支援 multi channel 包含 feishu
- [ ] README 文檔已更新
- [ ] 所有錯誤處理正確實作
- [ ] 配置驗證已實作

## 使用說明

完成實作後，用戶可以：

1. **配置飛書**：
   ```json
   {
     "channels": {
       "feishu": {
         "enabled": true,
         "appId": "cli_xxxxxxxxx",
         "appSecret": "your_app_secret",
         "defaultUserId": "ou_xxxxxxxxx"
       }
     }
   }
   ```

2. **CLI 使用**：
   ```bash
   npx kai-notify --cli notify --message "Hello Feishu!" --channel feishu
   ```

3. **MCP 模式**：
   透過 MCP 協議使用 `sendNotification` tool，指定 `channel: "feishu"`
