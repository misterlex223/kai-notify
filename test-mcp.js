#!/usr/bin/env node

import { spawn } from 'child_process';

// 啟動 MCP 服務器子進程
const child = spawn('node', ['index.js', '--mcp'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

// 用於存儲響應的緩衝區
let responseBuffer = '';

// 監聽服務器響應（MCP 協議響應可能出現在 stdout 或 stderr）
child.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  parseMCPResponse();
});

child.stderr.on('data', (data) => {
  // 日誌消息出現在 stderr，實際響應可能也在這裡
  const output = data.toString();
  if (output.includes('Content-Length')) {
    responseBuffer += output;
    parseMCPResponse();
  } else {
    console.log('Log message:', output);
  }
});

function parseMCPResponse() {
  // 簡單解析響應，查找 Content-Length
  try {
    const lines = responseBuffer.split('\r\n');
    let contentLength = 0;
    
    // 查找 Content-Length
    for (const line of lines) {
      if (line.startsWith('Content-Length:')) {
        contentLength = parseInt(line.split(':')[1].trim());
        break;
      }
    }
    
    // 如果找到 Content-Length，查找 JSON 響應
    if (contentLength > 0) {
      const jsonStart = responseBuffer.indexOf('\r\n\r\n');
      if (jsonStart > -1) {
        const jsonString = responseBuffer.substring(jsonStart + 4, jsonStart + 4 + contentLength);
        if (jsonString.length === contentLength) {
          try {
            const response = JSON.parse(jsonString);
            console.log('MCP Response:', JSON.stringify(response, null, 2));
            
            // 移除已處理的響應
            responseBuffer = responseBuffer.substring(jsonStart + 4 + contentLength);
            
            // 如果是錯誤響應，特別標記
            if (response.error) {
              console.log('⚠️  Received error response from MCP server:', response.error);
            } else if (response.result) {
              console.log('✅ Received success response from MCP server:', response.result);
            }
          } catch (e) {
            console.log('Error parsing JSON:', e.message);
          }
        }
      }
    }
  } catch (e) {
    console.log('Error parsing response:', e.message);
  }
}

// 等待子進程準備好後再發送請求
setTimeout(() => {
  // 發送測試請求
  const testRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "sendNotification",
      arguments: {
        channel: "line",
        message: "Test message from MCP",
        title: "MCP Test"
      }
    },
    id: 1
  };

  // 發送 MCP 格式請求
  const requestString = JSON.stringify(testRequest);
  const content = `Content-Length: ${requestString.length}\r\n\r\n${requestString}`;
  console.log('Sending request:', content);
  child.stdin.write(content);
}, 500);

// 3秒後結束進程
setTimeout(() => {
  child.kill();
}, 3000);