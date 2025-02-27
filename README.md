# 运动活动组织微信小程序

## 项目概述
本系统是一个基于微信小程序的运动活动组织工具，使用Google Sheets作为后端数据存储，实现轻量级的活动管理系统。主要功能包括：
- 活动创建与管理
- 参与者报名与签到
- 费用AA制结算
- 余额查询
- 活动历史记录

## 主要功能模块

### 1. 用户角色
- 场次管理员：可创建活动、管理报名、处理签到和结算
- 普通球友：可报名活动、查看活动、查看个人余额和消费记录

### 2. 活动管理
- 创建新活动（管理员）
- 编辑活动信息（管理员）
- 查看活动详情
- 取消活动（管理员）

### 3. 报名管理
- 活动报名（开始前2小时截止）
- 取消报名（活动开始前可取消）
- 查看报名状态
- 管理报名名单（管理员）

### 4. 签到管理
- 管理员统一签到确认
- 实时统计签到人数
- 自动计算人均费用

### 5. 费用结算
- 自动计算AA制费用
- 更新参与者余额
- 生成结算记录

### 6. 余额查询
- 查看个人余额
- 查看年度消费记录
- 余额充值（仅限管理员通过Google Sheets Web端操作）

## 技术架构
- 前端：微信小程序原生框架
- 后端存储：Google Sheets API
- 开发语言：TypeScript + WXML + WXSS
- 工具：微信开发者工具

## Google Sheets 数据结构

### 1. Record表（活动记录主表）
- 位置：第一个工作表
- 结构说明：
  * A-E列：固定用户信息
    - A列：用户姓名
    - B列：微信号
    - C列：押金金额
    - D列：当前余额
    - E列：年度消费
  * F列及之后：活动记录（每列一个活动）
    - 第2行：活动日期（格式：YYYY-MM-DD）
    - 第3行：场地信息（格式：X号场 - XX人）
    - 第4行：时间段（格式：HH:mm-HH:mm）
    - 第5行：总费用
    - 第6行及以下：参与者费用记录

### 2. Deposit Record表（押金记录表）
- 位置：第二个工作表
- 结构说明：
  * A列：操作日期
  * B列：用户姓名
  * C列：操作类型（充值/退款）
  * D列：金额
  * E列：操作后余额
  * F列：备注

### 3. Feecalcu表（费用计算表）
- 位置：第三个工作表
- 结构说明：
  * A列：活动ID
  * B列：计算日期
  * C列：参与人数
  * D列：总费用
  * E列：人均费用
  * F列：结算状态

### 4. User表（用户信息表）
- 位置：第四个工作表
- 用途：存储用户微信OpenID与微信名称的对应关系
- 结构说明：
  * A列：Wechat ID（微信名称）
  * B列：Pinyin Name（用户姓名拼音）
  * C列：OpenID（微信OpenID）
- 数据更新机制：
  * 自动从Record表和Deposit Record表收集用户信息
  * 保持与其他表格的用户数据同步
  * 支持增量更新，避免重复数据

## 数据写入规则

### 1. 创建新活动
- 目标：Record表
- 操作：在F列后插入新列
- 写入规则：
  ```javascript
  // 示例代码
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Record!F2:F5',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [
        [activity.date],
        [\`\${activity.fieldNo}号场 - \${activity.maxMembers}人\`],
        [\`\${activity.startTime}-\${activity.endTime}\`],
        [activity.totalFee]
      ]
    }
  });
  ```

### 2. 余额管理（仅限Google Sheets Web端）
- 管理员通过Google Sheets Web界面直接操作
- 更新Record表D列（余额）和Deposit Record表
- 确保同步更新以下数据：
  * Record表中的用户余额
  * Deposit Record表中的充值记录
  * 用户年度消费统计

### 3. 记录活动参与
- 目标：Record表
- 操作：在活动列的用户行写入费用
- 写入规则：
  ```javascript
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: \`Record!\${activityColumn}\${userRowIndex}\`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[perPersonFee]]
    }
  });
  ```

### 4. User表更新规则
- 触发时机：
  * 系统定期自动更新
  * 管理员手动触发更新
- 更新流程：
  1. 从Record表获取用户基本信息（姓名、微信ID）
  2. 从Deposit Record表获取用户充值记录
  3. 合并所有来源的用户数据
  4. 增量更新User表，保留已有的OpenID绑定
  5. 对新增用户初始化OpenID为空值
- 写入示例：
  ```javascript
  // User表更新示例
  async function updateUserTable() {
    // 1. 读取现有User表数据
    const existingUsers = await sheetsAPI.readSheet('User!A2:C');
    
    // 2. 收集所有用户数据
    const recordUsers = await sheetsAPI.readSheet('Record!A9:B');
    const depositUsers = await sheetsAPI.readSheet('Deposit Record!B2:B');
    
    // 3. 合并用户数据并更新
    const mergedUsers = mergeUserData(existingUsers, recordUsers, depositUsers);
    
    // 4. 写入更新后的数据
    await sheetsAPI.writeSheet('User!A2:C', mergedUsers);
  }
  ```

## 页面说明

### 1. 首页（/pages/index/index）
- 活动列表展示
- 新活动创建入口（管理员）
- 活动筛选和搜索

### 2. 活动详情页（/pages/activity/detail）
- 活动信息展示
- 报名/取消报名功能
- 签到入口（管理员）
- 结算入口（管理员）

### 3. 个人中心（/pages/user/index）
- 余额显示
- 活动历史
- 个人信息管理

### 4. 余额查询页（/pages/balance-manage/index）
- 只读显示用户余额
- 显示年度消费记录
- 支持下拉刷新更新数据

## 开发环境要求
- 微信开发者工具最新版
- 小程序基础库版本 >= 2.30.0
- Node.js >= 16.0.0
- TypeScript >= 4.0.0

## 项目结构
```
├── pages/
│   ├── index/            # 首页
│   ├── activity/         # 活动相关页面
│   ├── user/            # 用户中心
│   └── balance-manage/  # 余额查询页面
├── components/          # 公共组件
├── utils/              # 工具函数
│   ├── sheets.ts       # Google Sheets操作
│   └── format.ts       # 数据格式化
├── config/             # 配置文件
│   └── sheets.config.ts # Google Sheets配置
├── types/              # TypeScript类型定义
└── app.ts             # 小程序入口文件
```

## 安全说明
1. Google Sheets API密钥存储在小程序后台配置中
2. 管理员密码使用加密存储
3. 用户数据访问权限控制
4. 关键操作需二次确认
5. OpenID信息加密存储，确保用户隐私安全

## 注意事项
1. 所有金额计算保留两位小数
2. 活动创建后立即同步到Google Sheets
3. 定期备份Google Sheets数据
4. 确保网络请求超时处理
5. 活动状态变更实时更新
6. 余额管理必须通过Google Sheets Web端进行操作
7. User表定期自动同步，确保用户数据一致性
8. 手动修改用户信息后需及时更新User表

## 版本历史
- v1.0.0 初始版本：基本功能实现
- v1.1.0 增加Google Sheets集成
- v1.2.0 优化用户体验
- v1.3.0 添加管理员功能
- v1.4.0 移除小程序余额管理功能，改为Web端管理
- v1.5.0 新增User表及用户数据同步机制

## API接口说明

### 1. 微信登录接口
```typescript
// 登录请求
async function login(code: string): Promise<LoginResponse> {
  const res = await request.post('/auth/login', { code });
  return res.data;
}

// 登录响应类型
interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    balance: number;
    isAdmin: boolean;
  }
}
```

### 2. 请求封装
```typescript
// utils/request.ts
const request = {
  async get(url: string, params = {}) {
    return await this.request('GET', url, params);
  },
  
  async post(url: string, data = {}) {
    return await this.request('POST', url, data);
  },
  
  async request(method: string, url: string, data: any) {
    const token = wx.getStorageSync('token');
    try {
      const res = await wx.request({
        url: BASE_URL + url,
        method,
        data,
        header: {
          Authorization: token ? \`Bearer \${token}\` : ''
        }
      });
      
      if (res.data.code === 1002) {
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
    } catch (error) {
      console.error('请求失败:', error);
      wx.showToast({
        title: '网络请求失败',
        icon: 'none'
      });
      throw error;
    }
  }
};
```

### 3. 工具函数
```typescript
// utils/format.ts
export const format = {
  // 金额格式化
  formatAmount(amount: number): string {
    return amount.toFixed(2);
  },
  
  // 日期格式化
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('zh-CN');
  },
  
  // 时间格式化
  formatTime(time: string): string {
    return time.substring(0, 5);
  }
};

// utils/validator.ts
export const validator = {
  // 检查活动时间是否有效
  isValidActivityTime(startTime: string, endTime: string): boolean {
    return new Date(\`2000/01/01 \${startTime}\`) < new Date(\`2000/01/01 \${endTime}\`);
  },
  
  // 检查是否可以报名
  canJoinActivity(activityDate: string, startTime: string): boolean {
    const activityStart = new Date(\`\${activityDate} \${startTime}\`);
    const now = new Date();
    const hours = (activityStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hours >= 2;
  }
};
```

### 4. 错误码说明

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