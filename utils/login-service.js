/**
 * 微信小程序登录服务
 * 管理登录流程和用户信息获取
 */

// 默认头像
const DEFAULT_AVATAR = '/assets/icons/default-avatar.png';

class LoginService {
  constructor() {
    // 存储用户信息
    this.userInfo = null;
    // 存储用户code
    this.code = null;
    // 登录状态
    this.isLoggedIn = false;
    // 初始化检查登录状态
    this.checkLoginStatus();
  }

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const code = wx.getStorageSync('wx_code');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (code) {
      this.isLoggedIn = true;
      this.code = code;
      this.userInfo = userInfo;
      console.log('已检测到登录状态');
    } else {
      this.isLoggedIn = false;
      console.log('未检测到登录状态');
    }
    
    return this.isLoggedIn;
  }

  /**
   * 执行微信登录流程
   */
  async login() {
    try {
      console.log('开始执行登录流程');
      
      // 1. 获取临时登录凭证code
      const loginResult = await this.wxLogin();
      const code = loginResult.code;
      console.log('获取到临时登录凭证code:', code);
      
      // 2. 调用云函数获取 OpenID
      try {
        console.log('开始调用云函数获取 OpenID...');
        const cloudResult = await wx.cloud.callFunction({
          name: 'login'
        });
        
        console.log('云函数调用结果:', cloudResult);
        
        // 检查返回结果格式
        if (!cloudResult || !cloudResult.result) {
          throw new Error('云函数返回结果格式错误');
        }

        const { success, data, error } = cloudResult.result;
        
        if (success && data && data.openid) {
          const openid = data.openid;
          console.log('获取到OpenID:', openid);
          
          wx.setStorageSync('openid', openid);
          
          // 3. 在 Users 表中查找是否已存在该 OpenID
          const sheetsAPI = getApp().globalData.sheetsAPI;
          if (!sheetsAPI) {
            throw new Error('sheetsAPI未初始化');
          }

          console.log('开始在Users表中查找OpenID:', openid);
          const existingUser = await sheetsAPI.findUserByOpenId(openid);
          
          if (existingUser) {
            // 找到已绑定的用户，保存用户信息
            console.log('找到已绑定用户:', existingUser);
            wx.setStorageSync('wechatId', existingUser.wechatId);
            this.saveLoginState(code);
            return {
              success: true,
              code: code,
              openid: openid,
              user: existingUser
            };
          } else {
            // 未找到绑定用户，需要进行绑定
            console.log('未找到绑定用户，需要进行用户匹配');
            wx.redirectTo({
              url: '/pages/user-match/index'
            });
            return {
              success: true,
              needMatch: true,
              openid: openid
            };
          }
        } else {
          throw new Error(error || '获取OpenID失败');
        }
      } catch (cloudErr) {
        console.error('调用云函数失败:', cloudErr);
        throw cloudErr;
      }
    } catch (err) {
      console.error('登录失败:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
  
  /**
   * 调用wx.login获取临时登录凭证code
   * @returns {Promise} 登录结果
   */
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: res => {
          if (res.code) {
            resolve(res);
          } else {
            reject(new Error('获取code失败'));
          }
        },
        fail: err => reject(err)
      });
    });
  }
  
  /**
   * 保存登录状态
   * @param {string} code 临时登录凭证
   */
  saveLoginState(code) {
    wx.setStorageSync('wx_code', code);
    
    // 保存用户信息
    const wechatId = wx.getStorageSync('wechatId');
    const openid = wx.getStorageSync('openid');
    if (wechatId && openid) {
      const userInfo = {
        wechatId,
        openid
      };
      wx.setStorageSync('userInfo', userInfo);
      this.userInfo = userInfo;
    }
    
    this.isLoggedIn = true;
    this.code = code;
    
    console.log('已保存登录状态, code:', code);
  }
  
  /**
   * 清除登录状态
   */
  clearLoginState() {
    wx.removeStorageSync('wx_code');
    wx.removeStorageSync('userInfo');
    
    this.isLoggedIn = false;
    this.code = null;
    this.userInfo = null;
    
    console.log('已清除登录状态');
  }
  
  /**
   * 获取登录状态
   * @returns {boolean} 是否已登录
   */
  getLoginStatus() {
    return this.isLoggedIn;
  }
  
  /**
   * 获取用户信息
   * @returns {Object|null} 用户信息
   */
  getUserInfo() {
    return this.userInfo || wx.getStorageSync('userInfo');
  }

  // 获取真实用户信息
  async getUserProfile() {
    try {
      const res = await wx.getUserProfile({
        desc: '用于完善用户资料'
      });
      
      const userInfo = res.userInfo;
      wx.setStorageSync('userInfo', userInfo);
      this.userInfo = userInfo;
      
      return userInfo;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      throw err;
    }
  }
}

// 创建单例实例
const loginService = new LoginService();

// 修改导出方式，确保所有方法都正确绑定 this
module.exports = {
  login: loginService.login.bind(loginService),
  wxLogin: loginService.wxLogin.bind(loginService),
  saveLoginState: loginService.saveLoginState.bind(loginService),
  getUserInfo: loginService.getUserInfo.bind(loginService),
  getUserProfile: loginService.getUserProfile.bind(loginService),
  getLoginStatus: loginService.getLoginStatus.bind(loginService),
  clearLoginState: loginService.clearLoginState.bind(loginService),
  checkLoginStatus: loginService.checkLoginStatus.bind(loginService)
}; 