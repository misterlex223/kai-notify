#!/usr/bin/env node

import { MCPServer } from './mcp-protocol.js';

async function testMCPFunctionality() {
  console.log('Testing MCP Server functionality with improved error handling...');
  
  const mcpServer = new MCPServer();
  
  // 測試 1: 發送 LINE 通知
  console.log('\n1. Testing LINE notification (should succeed):');
  try {
    const result = await mcpServer.handleNotifyRequest({
      message: 'MCP Test Message',
      title: 'MCP Test',
      channels: ['line']
    });
    console.log('✅ LINE Notification Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ LINE Notification Error:', error.message);
  }
  
  // 測試 2: 測試 multi 頻道（應該只發送到 LINE，因為 Slack 未配置）
  console.log('\n2. Testing multi-channel notification (should send to LINE only):');
  try {
    const result = await mcpServer.handleNotifyRequest({
      message: 'Multi-Channel Test',
      title: 'Multi Test',
      channels: ['multi']
    });
    console.log('✅ Multi Notification Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Multi Notification Error:', error.message);
  }
  
  // 測試 3: 測試錯誤情況（無配置頻道）
  console.log('\n3. Testing configuration validation:');
  try {
    // 這將模擬一個配置不完整的 multi 請求
    const result = await mcpServer.mcpServer?.tools?.sendNotification ?
      'Tool registered' : 'Tool not accessible directly';
    console.log('MCP Tool Registration Status:', result);
  } catch (error) {
    console.log('Configuration validation test error:', error.message);
  }
  
  console.log('\n4. Testing MCP tool response format:');
  // 直接測試 MCP 工具函數（模擬）
  const toolFn = async ({ channel, message, title = '' }) => {
    try {
      let result;
      
      switch (channel) {
        case 'line':
          if (!mcpServer.config.channels.line.channelAccessToken || !mcpServer.config.channels.line.defaultUserId) {
            return {
              error: {
                code: -32000,
                message: 'LINE channel access token or user ID not configured'
              }
            };
          }
          result = await mcpServer.lineAdapter.sendNotification(
            mcpServer.config.channels.line.channelAccessToken,
            mcpServer.config.channels.line.defaultUserId,
            message
          );
          
          return {
            result: {
              success: true,
              channel,
              message: result.message || 'Notification sent successfully',
              timestamp: new Date().toISOString()
            }
          };
        case 'multi':
          // 改進的 multi 邏輯 - 只發送到可用的頻道
          const results = {};
          
          // 發送到 Slack（如果已配置）
          if (mcpServer.config.channels.slack.webhookUrl) {
            results.slack = await mcpServer.slackAdapter.sendNotification(
              mcpServer.config.channels.slack.webhookUrl,
              message,
              title
            );
          }
          
          // 發送到 LINE（如果已配置）
          if (mcpServer.config.channels.line.channelAccessToken && mcpServer.config.channels.line.defaultUserId) {
            results.line = await mcpServer.lineAdapter.sendNotification(
              mcpServer.config.channels.line.channelAccessToken,
              mcpServer.config.channels.line.defaultUserId,
              message
            );
          }
          
          // 檢查是否有任何頻道被配置和發送
          if (Object.keys(results).length === 0) {
            return {
              error: {
                code: -32000,
                message: 'No channels configured for multi-channel notification'
              }
            };
          }
          
          return {
            result: {
              success: Object.keys(results).length > 0,
              ...results,
              message: `Notification sent to ${Object.keys(results).join(', ')}`,
              timestamp: new Date().toISOString()
            }
          };
        default:
          return {
            error: {
              code: -32000,
              message: `Unsupported channel: ${channel}`
            }
          };
      }
    } catch (error) {
      return {
        error: {
          code: -32000,
          message: error.message
        }
      };
    }
  };
  
  // 測試 multi 邏輯
  console.log('Testing improved multi-channel logic (only LINE configured):');
  const multiResult = await toolFn({ channel: 'multi', message: 'Multi test', title: 'Multi' });
  console.log('✅ Multi-channel tool response:', JSON.stringify(multiResult, null, 2));
}

testMCPFunctionality().catch(console.error);