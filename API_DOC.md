# 运动活动组织系统 API 文档

## 基础信息

- 基础URL: `http://your-api-domain/api`
- 所有请求都需要在header中携带token: `Authorization: Bearer your_token`
- 所有响应格式统一为：
```json
{
  "code": 0,        // 错误码，0表示成功
  "message": "ok",  // 错误信息
  "data": {}        // 响应数据
}
```

## 1. 认证相关接口

### 1.1 微信登录
```http
POST /auth/login
```

**请求参数：**
```json
{
  "code": "wx.login获取的code"
}
```

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user123",
      "name": "张三",
      "avatar": "https://xxx.com/avatar.png",
      "balance": 100.00,
      "isAdmin": false
    }
  }
}
```

**注意事项：**
- token有效期为7天
- 首次登录会自动创建用户账号

### 1.2 更新用户信息
```http
PUT /auth/user/info
```

**请求参数：**
```json
{
  "name": "新名字",
  "avatar": "新头像地址"
}
```

## 2. 活动相关接口

### 2.1 获取活动列表
```http
GET /activities?page=1&pageSize=10&status=all
```

**查询参数：**
- page: 页码，默认1
- pageSize: 每页数量，默认10
- status: 活动状态，可选值：all/upcoming/ongoing/completed

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "total": 100,
    "list": [{
      "id": "1",
      "title": "周末篮球友谊赛",
      "date": "2024-03-23",
      "startTime": "14:00",
      "endTime": "16:00",
      "location": "星光体育馆",
      "currentMembers": 8,
      "maxMembers": 10,
      "totalPrice": 200,
      "price": 25,
      "status": "upcoming",
      "coverImage": "https://xxx.com/image.jpg"
    }]
  }
}
```

### 2.2 获取活动详情
```http
GET /activities/{id}
```

**响应字段说明：**
- hasCheckedIn: 用户是否已签到
- organizer: 组织者信息
- participants: 参与者列表

### 2.3 报名活动
```http
POST /activities/{id}/join
```

**注意事项：**
- 需要验证用户余额是否充足
- 活动必须是upcoming状态
- 不能重复报名
- 不能报名已满的活动

### 2.4 活动签到
```http
POST /activities/{id}/check-in
```

**签到规则：**
- 活动开始前30分钟可以开始签到
- 活动开始后30分钟内可以补签
- 每个用户只能签到一次

## 3. 余额相关接口

### 3.1 余额充值
```http
POST /balance/recharge
```

**请求参数：**
```json
{
  "amount": 100  // 充值金额，必须大于0
}
```

### 3.2 获取交易记录
```http
GET /balance/transactions
```

**交易类型说明：**
- RECHARGE: 充值
- JOIN_ACTIVITY: 参加活动
- REFUND: 退款

## 4. 管理员接口

### 4.1 调整用户余额
```http
POST /admin/users/{id}/balance
```

**请求参数：**
```json
{
  "amount": 100,
  "type": "ADD",  // ADD或SUBTRACT
  "reason": "活动退款"
}
```

### 4.2 活动费用结算
```http
POST /activities/{id}/settlement
```

**请求参数：**
```json
{
  "participants": [{
    "userId": "user123",
    "amount": 25
  }]
}
```

**注意事项：**
- 结算金额总和必须等于活动总费用
- 结算后活动状态会变更为completed

## 错误码说明

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 0 | 成功 | - |
| 1001 | 参数错误 | 检查请求参数 |
| 1002 | 未登录或登录已过期 | 重新登录 |
| 2001 | 余额不足 | 提示用户充值 |
| 2002 | 活动已满员 | 提示用户选择其他活动 |
| 2003 | 活动已开始 | 提示用户活动已开始 |
| 2004 | 未到签到时间 | 显示倒计时 |
| 2005 | 签到时间已过 | 提示用户签到已结束 |
| 3001 | 无管理员权限 | 使用管理员账号 |
| 3002 | 结算金额错误 | 检查结算金额 |

## 前端开发注意事项

1. 登录流程：
```javascript
// 1. 调用微信登录
wx.login({
  success: async (res) => {
    if (res.code) {
      // 2. 发送code到后端
      const loginRes = await request.post('/auth/login', { code: res.code });
      // 3. 保存token
      wx.setStorageSync('token', loginRes.data.token);
    }
  }
});
```

2. 请求封装：
```javascript
const request = {
  async get(url, params = {}) {
    return await this.request('GET', url, params);
  },
  async post(url, data = {}) {
    return await this.request('POST', url, data);
  },
  async request(method, url, data) {
    const token = wx.getStorageSync('token');
    const res = await wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    
    if (res.data.code === 1002) {
      // token过期，重新登录
      wx.redirectTo({ url: '/pages/login/index' });
      return;
    }
    
    if (res.data.code !== 0) {
      wx.showToast({
        title: res.data.message,
        icon: 'none'
      });
      throw new Error(res.data.message);
    }
    
    return res.data;
  }
};
```

3. 活动状态处理：
```javascript
const STATUS_MAP = {
  upcoming: '即将开始',
  ongoing: '进行中',
  completed: '已结束'
};

const STATUS_CLASS = {
  upcoming: 'primary',
  ongoing: 'success',
  completed: 'default'
};
```

4. 签到时间判断：
```javascript
function canCheckIn(activity) {
  const now = new Date();
  const start = new Date(`${activity.date} ${activity.startTime}`);
  const diffMinutes = (start - now) / 1000 / 60;
  return diffMinutes <= 30 && diffMinutes >= -30;
}
```

5. 余额格式化：
```javascript
function formatBalance(balance) {
  return balance.toFixed(2);
}
```

