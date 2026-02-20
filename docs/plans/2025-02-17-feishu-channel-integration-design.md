# 飛書 Channel 集成設計

**日期**: 2025-02-17  
**狀態**: Approved  
**作者**: Claude Code

## 1. 概述

本設計文檔描述如何在 kai-notify 專案中新增飛書（Feishu/Lark）通知通道支援。

## 2. 需求總結

| 項目 | 選擇 |
|------|------|
| 接收端類型 | 飛書用戶 (User) |
| API 方式 | 官方 Feishu SDK |
| 消息類型 | 純文字（可擴展） |
| 認證方式 | App Credentials (app_id + app_secret) |

## 3. 架構設計

### 3.1 目錄結構

```
kai-notify
├── adapters/
│   ├── slack-adapter.js    (現有)
│   ├── line-adapter.js     (現有)
│   └── feishu-adapter.js   (新增)
├── config/
│   ├── config-manager.js   (修改：支援 feishu 配置)
│   └── config.json         (修改：添加 feishu 示例)
├── mcp-protocol.js         (修改：添加 feishu 支援)
└── package.json            (修改：添加 feishu SDK 依賴)
```

### 3.2 設計原則

- 遵循現有的 Adapter 模式
- 與 SlackAdapter 和 LineAdapter 保持一致的介面
- 支援 CLI 和 MCP Server 兩種模式

## 4. 組件設計

### 4.1 FeishuAdapter 類

```javascript
class FeishuAdapter {
  constructor()
    - 讀取配置 (app_id, app_secret, defaultUserId)
    - 初始化 Feishu SDK client
    - 設置 enabled 狀態

  async sendNotification(userId, message, title = '')
    - 構建消息 payload（純文字類型）
    - 調用飛書 API 發送消息
    - 返回標準格式 { success, data, message }
}
```

### 4.2 配置結構

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxx",
      "defaultUserId": "ou_xxxxxxxxx"
    }
  }
}
```

### 4.3 新增依賴

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.29.0"
  }
}
```

## 5. 數據流設計

### 5.1 MCP Server 模式

```
AI/Claude → stdin (JSON-RPC) → MCPServer
                                    ↓
                            sendNotification tool
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓               ↓               ↓
                SlackAdapter   LineAdapter   FeishuAdapter
                                                    ↓
                                            Feishu SDK → API
                                                    ↓
                                            飛書用戶收到消息
```

### 5.2 CLI 模式

```
CLI 命令 → index.js → MCPServer.handleNotifyRequest()
                                    ↓
                            依 channel 分發
                                    ↓
                            FeishuAdapter.sendNotification()
                                    ↓
                            返回 JSON 結果
```

### 5.3 Channel 支援

- `feishu`: 僅發送到飛書
- `multi`: 發送到所有已啟用的通道（slack + line + feishu）

## 6. 錯誤處理設計

### 6.1 配置驗證

```javascript
// 檢查必需配置
if (!appId || !appSecret) {
  throw new Error('Feishu appId or appSecret not configured');
}
```

### 6.2 API 錯誤處理

```javascript
try {
  const response = await client.message.sendMessage({...});
  // 檢查 response.code
  if (response.code !== 0) {
    throw new Error(`Feishu API error: ${response.msg}`);
  }
} catch (error) {
  logger.error('Error sending Feishu notification:', error);
  throw error;
}
```

### 6.3 MCP 錯誤響應

```javascript
// 配置缺失
{
  error: {
    code: -32000,
    message: 'Feishu appId or appSecret not configured'
  }
}

// API 失敗
{
  error: {
    code: -32603,
    message: 'Internal server error: ...'
  }
}
```

### 6.4 Multi-channel 容錯

```javascript
// multi 模式下，飛書失敗不影響其他通道
try {
  results.feishu = await this.feishuAdapter.sendNotification(...);
} catch (feishuError) {
  logger.error('Error sending to Feishu in multi-channel mode');
  // 繼續發送其他通道
}
```

## 7. 測試設計

### 7.1 單元測試

- FeishuAdapter 初始化正確
- 配置缺失時拋出正確錯誤
- 消息成功發送到飛書用戶
- API 錯誤正確處理和記錄

### 7.2 CLI 集成測試

```bash
# 發送飛書通知
npx kai-notify --cli notify --message "Test message" --channel feishu

# 檢查健康狀態
npx kai-notify --cli health

# 檢查配置
npx kai-notify --cli config
```

### 7.3 MCP 模式測試

```bash
# 通過 stdin 測試
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sendNotification","arguments":{"channel":"feishu","message":"Test"}},"id":1}' | npx kai-notify --mcp
```

### 7.4 測試清單

- [ ] FeishuAdapter 初始化正確
- [ ] 配置缺失時拋出正確錯誤
- [ ] 消息成功發送到飛書用戶
- [ ] API 錯誤正確處理和記錄
- [ ] CLI 模式正確調用 feishu channel
- [ ] MCP 模式正確處理 feishu channel
- [ ] multi-channel 模式包含 feishu
- [ ] README 文檔更新

## 8. 實作計劃

實作計劃將在下一步使用 `writing-plans` skill 詳細規劃。

## 9. 參考資料

- [飛書開放平台 API 文檔](https://open.feishu.cn/document/server-docs/api-overview)
- [@larksuiteoapi/node-sdk](https://www.npmjs.com/package/@larksuiteoapi/node-sdk)
- 現有 Slack/Line adapter 實作
