/**
 * 微信小程序登录服务
 * 管理登录流程和用户信息获取
 */

const { userService } = require('../services/user-service');
const sheetsAPI = require('./sheets-api');

// 默认头像
const DEFAULT_AVATAR = '/assets/icons/default-avatar.png';

class LoginService {
  // 获取OpenID
  async getOpenId(code) {
    try {
      if (!code) {
        throw new Error('登录code不能为空');
      }

      const result = await wx.cloud.callFunction({
        name: 'login'
      });
      console.log('云函数返回结果:', result);

      if (!result.result.success || !result.result.data.openid) {
        throw new Error(result.result.error || '获取OpenID失败');
      }

      const { openid } = result.result.data;
      return { openid };
    } catch (err) {
      console.error('获取OpenID失败:', err);
      throw err;
    }
  }

  // 处理登录
  async handleLogin(code) {
    try {
      // 1. 获取OpenID
      const { openid } = await this.getOpenId(code);
      console.log('获取到OpenID:', openid);

      // 2. 初始化 sheetsAPI
      await sheetsAPI.initialize();
      console.log('sheetsAPI 初始化完成');

      // 3. 在Users表中查找用户
      const existingUser = await sheetsAPI.findUserByOpenId(openid);
      console.log('查找用户结果:', existingUser);

      if (existingUser) {
        // 4a. 用户存在，使用已有信息
        const userInfo = {
          openid,
          wechatId: existingUser.wechatId,
          name: existingUser.name || '微信用户',
          pinyinName: existingUser.pinyinName || '',
          balance: existingUser.balance || '0.00'
        };

        // 保存登录状态
        this.saveLoginState(userInfo);
        console.log('使用已有用户信息:', userInfo);
        return userInfo;

      } else {
        // 4b. 用户不存在，创建新用户
        const wechatId = `user_${openid.slice(-8)}`;
        const newUser = {
          openid,
          wechatId,
          name: '微信用户',
          pinyinName: '',
          balance: '0.00'
        };

        // 创建新用户记录
        await sheetsAPI.createNewUser(newUser);
        console.log('创建新用户:', newUser);

        // 保存登录状态
        this.saveLoginState(newUser);
        return newUser;
      }

    } catch (err) {
      console.error('登录失败:', err);
      throw err;
    }
  }

  // 保存登录状态
  saveLoginState(userInfo) {
    try {
      wx.setStorageSync('openid', userInfo.openid);
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('wechatId', userInfo.wechatId);
      wx.setStorageSync('loginTime', Date.now());
      console.log('登录状态已保存');
    } catch (err) {
      console.error('保存登录状态失败:', err);
      throw err;
    }
  }

  // 检查登录状态
  checkLoginStatus() {
    try {
      const loginTime = wx.getStorageSync('loginTime');
      const userInfo = wx.getStorageSync('userInfo');
      
      if (!loginTime || !userInfo) return false;

      const now = Date.now();
      const expired = now - loginTime > 24 * 60 * 60 * 1000;
      
      return !expired;
    } catch {
      return false;
    }
  }

  // 获取用户信息
  getUserInfo() {
    try {
      return wx.getStorageSync('userInfo');
    } catch {
      return null;
    }
  }

  // 清除登录状态
  clearLoginStatus() {
    try {
      wx.removeStorageSync('loginCode');
      wx.removeStorageSync('loginTime');
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('wechatId');
    } catch (err) {
      console.error('清除登录状态失败:', err);
    }
  }
}

// 创建并导出单例
const loginService = new LoginService();
module.exports = loginService; 