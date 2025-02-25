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
   * @returns {Promise} 登录结果
   */
  async login() {
    try {
      console.log('开始执行登录流程');
      
      // 调用微信登录API获取临时登录凭证code
      const loginResult = await this.wxLogin();
      const code = loginResult.code;
      
      console.log('获取到临时登录凭证code:', code);
      
      // 保存登录状态
      this.saveLoginState(code);
      
      return {
        success: true,
        code: code
      };
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

// 使用微信小程序支持的模块导出方式
module.exports = {
  login: loginService.login.bind(loginService),
  wxLogin: loginService.wxLogin.bind(loginService),
  getUserInfo: loginService.getUserInfo.bind(loginService),
  getUserProfile: loginService.getUserProfile.bind(loginService),
  getLoginStatus: loginService.getLoginStatus.bind(loginService),
  clearLoginState: loginService.clearLoginState.bind(loginService),
  checkLoginStatus: loginService.checkLoginStatus.bind(loginService)
}; 