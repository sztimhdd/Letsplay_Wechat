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
    - 第2行：活动日期（格式：M/DD/YYYY,例如 "2/28/2025"）
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

### 4. Users表（用户信息表）
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

### 4. Users表更新规则
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
```

## 项目设置

### 凭证配置

本项目使用Google Sheets API进行数据存储和读取。为了使项目正常运行，你需要配置以下凭证文件：

1. `utils/credentials.js` - Google Sheets API凭证文件

这些文件包含敏感信息，已在`.gitignore`和`.gitignore_global`中配置为不上传到GitHub。

#### 如何配置凭证

1. 从项目管理员处获取Google Sheets API凭证JSON文件
2. 在项目根目录创建`utils/credentials.js`文件，内容如下：

```javascript
// Google Sheets API 凭证
export const credentials = {
  "type": "service_account",
  "project_id": "你的project_id",
  "private_key_id": "你的private_key_id",
  "private_key": "你的private_key",
  "client_email": "你的client_email",
  "client_id": "你的client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "你的client_x509_cert_url",
  "universe_domain": "googleapis.com"
};
```

3. 将JSON文件中的相应值填入上述模板中

### Git配置

为了确保敏感凭证不会被上传到GitHub，我们使用了全局gitignore文件：

```bash
git config --local core.excludesfile .gitignore_global
```

这将确保`utils/credentials.js`和其他敏感文件不会被Git跟踪。

## 项目功能

[在这里添加项目功能描述]

## 开发指南

[在这里添加开发指南]

## 用户匹配流程

### 用户登录与匹配流程

1. **登录流程**
   - 用户打开小程序，系统自动调用微信登录API获取code
   - 通过云函数获取用户OpenID
   - 在Users表中查找是否有匹配的OpenID记录

2. **用户匹配**
   - 如果找到匹配的OpenID记录，直接使用该用户信息
   - 如果未找到匹配记录，引导用户进入用户匹配页面
   - 用户输入微信名称（而非微信ID），系统在Record表中搜索匹配的用户
   - 系统会显示匹配到的用户列表，包含微信名称、拼音和余额信息
   - 用户选择自己的账户并绑定OpenID
   - 如果未找到匹配用户，用户可以创建新用户记录

3. **用户创建**
   - 用户输入微信名称
   - 系统在Users表中创建新行，包含微信名称和OpenID
   - 完成用户创建后，跳转回首页

### 数据同步机制

1. **OpenID绑定**
   - 用户首次登录时，将OpenID与微信名称绑定
   - 绑定信息存储在Users表中
   - 后续登录时，通过OpenID自动识别用户

2. **用户数据更新**
   - 定期同步Users表与Record表的用户数据
   - 确保用户信息在各表之间保持一致
   - 支持管理员通过Google Sheets Web端手动更新用户信息

### 安全措施

1. **OpenID保护**
   - OpenID仅在Users表中存储，不在前端显示
   - 用户匹配过程中，OpenID信息加密传输
   - 防止用户信息被非授权访问

2. **数据验证**
   - 用户创建和更新时进行数据验证
   - 确保微信名称格式正确
   - 防止重复创建用户记录

## 最新功能更新

### 1. 用户匹配优化
- **微信名称匹配**：用户现在可以通过输入微信名称（而非微信ID）来匹配自己的账户
- **模糊搜索**：支持模糊搜索，用户只需输入名称的一部分即可找到匹配账户
- **信息展示优化**：匹配结果现在显示用户的微信名称、拼音和余额信息，方便用户识别自己的账户

### 2. 界面优化
- **用户友好提示**：添加了更清晰的用户引导和提示信息
- **加载状态显示**：在各种操作过程中显示加载状态，提升用户体验
- **错误处理优化**：优化了错误提示，使用户更容易理解问题并采取相应行动

### 3. 数据结构调整
- **Record表数据理解**：明确了Record表中A列为用户姓名拼音，B列为微信名称
- **用户标识统一**：在整个系统中统一使用微信名称作为用户的主要标识
- **数据读取优化**：优化了从Google Sheets读取数据的逻辑，提高了查询效率

### 4. 安全性增强
- **登录状态检查**：增强了登录状态的检查机制，确保用户在操作前已正确登录
- **页面重定向**：优化了未登录状态下的页面重定向逻辑，提供更流畅的用户体验
- **数据验证**：增加了数据输入验证，防止不合法数据的提交

### 5. 性能优化
- **代码重构**：重构了部分核心功能代码，提高了代码质量和可维护性
- **API调用优化**：优化了Google Sheets API的调用逻辑，减少不必要的请求
- **缓存机制**：实现了适当的数据缓存机制，减少重复数据加载

## 未来计划

### 1. 功能扩展
- **活动推荐**：基于用户历史参与记录，推荐可能感兴趣的活动
- **消息通知**：活动变更、余额变动等重要信息的推送通知
- **数据统计**：提供个人活动参与统计和消费分析

### 2. 技术优化
- **离线支持**：增强离线数据处理能力，减少网络依赖
- **性能监控**：添加性能监控工具，及时发现和解决性能瓶颈
- **自动化测试**：建立自动化测试流程，提高代码质量和稳定性

### 3. 用户体验提升
- **界面主题**：支持自定义界面主题和颜色方案
- **操作引导**：为新用户提供更详细的操作引导
- **无障碍支持**：增强应用的无障碍特性，支持更多用户群体