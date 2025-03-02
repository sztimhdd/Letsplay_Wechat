/**
 * 微信小程序登录服务
 * 管理登录流程和用户信息获取
 */

const { userService } = require('../services/user-service');

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
      
      // 保存OpenID到本地存储，以便后续使用
      wx.setStorageSync('openid', openid);

      // 2. 检查并初始化 sheetsAPI
      // 延迟导入sheetsAPI，避免循环依赖
      const { sheetsAPI } = require('./sheets-api');
      
      if (!sheetsAPI) {
        console.error('sheetsAPI 未定义');
        throw new Error('系统初始化失败');
      }

      try {
        await sheetsAPI.initialize();
        console.log('sheetsAPI 初始化完成');
      } catch (initErr) {
        console.error('sheetsAPI 初始化失败:', initErr);
        throw new Error('系统初始化失败');
      }

      // 3. 在Users表中查找用户
      let existingUser = null;
      try {
        existingUser = await sheetsAPI.findUserByOpenId(openid);
        console.log('查找用户结果:', existingUser);
      } catch (findErr) {
        console.error('查找用户失败:', findErr);
        // 如果是因为users.find不是函数导致的错误，我们认为是没有找到用户
        if (findErr.message && findErr.message.includes('find is not a function')) {
          existingUser = null;
        } else {
          throw findErr;
        }
      }

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
        // 4b. 用户不存在，引导用户前往匹配页面
        console.log('未找到匹配用户，需要引导用户进行手动匹配');
        
        // 创建临时用户信息
        const tempUserInfo = {
          openid,
          needMatch: true  // 标记需要匹配
        };
        
        // 保存临时登录状态
        this.saveLoginState(tempUserInfo);
        
        // 引导用户前往匹配页面
        wx.redirectTo({
          url: '/pages/user-match/index',
          fail: (err) => {
            console.error('跳转到用户匹配页面失败:', err);
            // 如果跳转失败，尝试使用navigateTo
            wx.navigateTo({
              url: '/pages/user-match/index',
              fail: (err2) => {
                console.error('navigateTo到用户匹配页面也失败:', err2);
                throw new Error('无法跳转到用户匹配页面');
              }
            });
          }
        });
        
        return tempUserInfo;
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

  // 页面登录检查
  checkPageLogin() {
    const isLoggedIn = this.checkLoginStatus();
    if (!isLoggedIn) {
      console.log('页面检测到用户未登录，跳转到登录页面');
      
      // 强制延迟执行，确保页面不会继续执行后续代码
      setTimeout(() => {
        // 首先尝试navigateTo
        wx.navigateTo({
          url: '/pages/login/index',
          fail: (err) => {
            console.error('navigateTo到登录页面失败:', err);
            // 如果navigateTo失败，尝试redirectTo
            wx.redirectTo({
              url: '/pages/login/index',
              fail: (err2) => {
                console.error('redirectTo到登录页面失败:', err2);
                // 如果redirectTo也失败，尝试reLaunch
                wx.reLaunch({
                  url: '/pages/login/index',
                  fail: (err3) => {
                    console.error('reLaunch到登录页面也失败:', err3);
                    wx.showToast({
                      title: '无法跳转到登录页面',
                      icon: 'none'
                    });
                  }
                });
              }
            });
          }
        });
      }, 0);
      
      throw new Error('USER_NOT_LOGGED_IN'); // 抛出错误以中断当前函数执行
    }
    
    // 检查用户是否需要匹配
    const userInfo = this.getUserInfo();
    if (userInfo && userInfo.needMatch) {
      console.log('用户需要进行匹配，跳转到匹配页面');
      
      // 强制延迟执行，确保页面不会继续执行后续代码
      setTimeout(() => {
        // 首先尝试navigateTo
        wx.navigateTo({
          url: '/pages/user-match/index',
          fail: (err) => {
            console.error('navigateTo到用户匹配页面失败:', err);
            // 如果navigateTo失败，尝试redirectTo
            wx.redirectTo({
              url: '/pages/user-match/index',
              fail: (err2) => {
                console.error('redirectTo到用户匹配页面失败:', err2);
                // 如果redirectTo也失败，尝试reLaunch
                wx.reLaunch({
                  url: '/pages/user-match/index',
                  fail: (err3) => {
                    console.error('reLaunch到用户匹配页面也失败:', err3);
                    wx.showToast({
                      title: '无法跳转到匹配页面',
                      icon: 'none'
                    });
                  }
                });
              }
            });
          }
        });
      }, 0);
      
      throw new Error('USER_NEEDS_MATCHING'); // 抛出错误以中断当前函数执行
    }
    
    return true;
  }

  // 微信登录
  async wxLogin() {
    try {
      const { code } = await wx.login();
      return { code };
    } catch (err) {
      console.error('微信登录失败:', err);
      throw err;
    }
  }

  // 登录方法（供页面调用）
  async login() {
    try {
      // 1. 获取登录凭证
      const { code } = await this.wxLogin();
      if (!code) {
        console.error('获取登录凭证失败');
        return { success: false, error: '获取登录凭证失败' };
      }
      
      // 2. 处理登录
      try {
        const userInfo = await this.handleLogin(code);
        return { success: true, userInfo };
      } catch (loginErr) {
        console.error('登录处理失败:', loginErr);
        
        // 如果是需要匹配的错误，返回特殊状态
        if (loginErr.message && loginErr.message.includes('无法跳转到用户匹配页面')) {
          return { 
            success: false, 
            needMatch: true,
            error: '需要进行用户匹配' 
          };
        }
        
        // 其他错误
        return { 
          success: false, 
          error: loginErr.message || '登录失败' 
        };
      }
    } catch (err) {
      console.error('登录过程发生错误:', err);
      return { 
        success: false, 
        error: err.message || '登录失败',
        details: err.stack
      };
    }
  }
}

// 创建并导出单例
const loginService = new LoginService();
module.exports = loginService; 