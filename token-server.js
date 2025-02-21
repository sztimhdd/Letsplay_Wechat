const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();

// 允许所有来源的请求
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 增加请求超时时间
app.use((req, res, next) => {
  res.setTimeout(30000); // 30秒超时
  next();
});

// 读取服务账号凭据
const credentials = require('./skyline-g-1-712f074cafbd.json');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 创建JWT客户端
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  SCOPES
);

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/getGoogleToken', async (req, res) => {
  try {
    console.log('开始获取token...');
    const token = await auth.authorize();
    console.log('token获取成功');
    res.json({
      access_token: token.access_token,
      expires_in: token.expiry_date - Date.now()
    });
  } catch (error) {
    console.error('Token获取失败:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Token服务器运行在 http://localhost:${PORT}`);
});

// 设置服务器超时
server.timeout = 30000; // 30秒

// 处理进程终止信号
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
}); 