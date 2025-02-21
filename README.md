# 微信小程序 - 活动费用结算系统

## 项目概述
本系统是一个用于管理活动费用结算的微信小程序，主要功能包括：
- 活动创建与管理
- 参与者签到管理
- 费用AA制结算
- 用户余额管理
- 活动历史记录

## 主要功能模块

### 1. 活动管理
- 创建新活动
- 编辑活动信息
- 查看活动详情
- 管理活动参与者

### 2. 签到管理
- 参与者签到/签出
- 实时统计签到人数
- 自动计算人均费用

### 3. 费用结算
- 自动计算AA制费用
- 更新参与者余额
- 生成结算记录
- 支持重新计算

### 4. 用户管理
- 用户余额管理
- 活动参与记录
- 个人信息维护

## 技术架构
- 前端：微信小程序原生框架
- 数据存储：微信小程序本地存储
- 开发语言：JavaScript + WXML + WXSS
- 工具：微信开发者工具

## API接口说明

### 1. 活动相关接口

#### 获取活动列表
- 方法：`wx.getStorageSync('activities')`
- 返回：活动数组
- 示例：
  ```javascript
  const activities = wx.getStorageSync('activities') || [];
  ```

#### 获取单个活动详情
- 方法：`Array.find()`
- 参数：活动ID
- 示例：
  ```javascript
  const activity = activities.find(a => a.id === activityId);
  ```

#### 更新活动信息
- 方法：`wx.setStorageSync()`
- 示例：
  ```javascript
  wx.setStorageSync('activities', updatedActivities);
  ```

### 2. 用户相关接口

#### 获取用户信息
- 方法：`wx.getStorageSync('users')`
- 返回：用户数组
- 示例：
  ```javascript
  const users = wx.getStorageSync('users') || [];
  ```

#### 更新用户余额
- 方法：`wx.setStorageSync()`
- 示例：
  ```javascript
  wx.setStorageSync('users', updatedUsers);
  ```

### 3. 费用计算接口

#### 计算人均费用
- 方法：`calculateAA(total, count)`
- 参数：
  - total: 总费用
  - count: 参与人数
- 返回：人均费用（保留两位小数）
- 示例：
  ```javascript
  const perPersonFee = calculateAA(activity.totalPrice, participants.length);
  ```

### 4. 数据格式化接口

#### 金额格式化
- 方法：`formatFee(fee)`
- 参数：金额数值
- 返回：格式化后的金额字符串
- 示例：
  ```wxml
  <text>¥{{format.formatFee(amount)}}</text>
  ```

## 数据模型

### 活动对象
  ```javascript
{
id: Number, // 活动ID
title: String, // 活动标题
date: String, // 活动日期
startTime: String, // 开始时间
endTime: String, // 结束时间
location: String, // 活动地点
totalPrice: Number, // 总费用
participants: Array // 参与者列表
}
  ```
### 用户对象
  ```javascript
{
id: Number, // 用户ID
name: String, // 用户名
avatar: String, // 头像URL
balance: Number, // 账户余额
phone: String // 联系电话
}
  ```

## 开发说明

### 环境要求
- 微信开发者工具最新版
- 小程序基础库版本 >= 2.0.0

### 项目结构
├── pages
│ ├── activity-detail # 活动详情页
│ ├── check-in # 签到页面
│ ├── fee-settlement # 费用结算页面
│ └── ... # 其他页面
├── utils
│ └── format.wxs # 数据格式化工具
├── mock
│ ├── activities.js # 活动假数据
│ └── users.js # 用户假数据
└── app.js # 小程序入口文件

## 注意事项
1. 所有金额计算保留两位小数
2. 用户余额在结算时自动更新
3. 活动状态变更后需及时更新本地存储
4. 确保参与者ID与用户ID一致

## 版本历史
- v1.0.0 初始版本
- v1.1.0 增加费用结算功能
- v1.2.0 优化用户余额管理