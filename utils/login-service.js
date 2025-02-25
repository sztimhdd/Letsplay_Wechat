/**
 * 微信小程序登录服务
 * 管理登录流程和用户信息获取
 */

class LoginService {
  constructor() {
    // 存储用户信息
    this.userInfo = null;
    // 存储用户openid
    this.openid = null;
    // 登录状态
    this.isLoggedIn = false;
    // 初始化检查登录状态
    this.checkLoginStatus();
  }

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const openid = wx.getStorageSync('openid');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && openid) {
      this.isLoggedIn = true;
      this.openid = openid;
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
      
      // 1. 调用微信登录API获取临时登录凭证code
      const loginResult = await this.wxLogin();
      const code = loginResult.code;
      
      console.log('获取到临时登录凭证code:', code);
      
      // 2. 发送code到服务器换取openid和session_key
      // 在这个示例中，我们将直接使用code模拟获取openid的过程
      // 实际项目中应该发送到你的服务器获取真实openid
      const openid = await this.mockGetOpenid(code);
      
      // 3. 保存登录状态
      this.saveLoginState(openid);
      
      return {
        success: true,
        openid: openid
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
   * 模拟从服务器获取openid
   * 实际项目中应该将code发送到你的服务器，由服务器调用微信接口获取
   * @param {string} code 临时登录凭证
   * @returns {Promise<string>} openid
   */
  mockGetOpenid(code) {
    return new Promise((resolve) => {
      // 这里使用code生成一个模拟的openid
      // 实际项目中需要从服务器获取真实openid
      const mockOpenid = 'openid_' + code + '_' + Date.now();
      
      // 模拟网络请求延迟
      setTimeout(() => {
        resolve(mockOpenid);
      }, 500);
    });
  }
  
  /**
   * 保存登录状态
   * @param {string} openid 用户openid
   */
  saveLoginState(openid) {
    // 生成模拟的token
    const token = 'token_' + openid + '_' + Date.now();
    
    // 保存到本地存储
    wx.setStorageSync('token', token);
    wx.setStorageSync('openid', openid);
    
    // 更新登录状态
    this.isLoggedIn = true;
    this.openid = openid;
    
    console.log('已保存登录状态, openid:', openid);
  }
  
  /**
   * 清除登录状态
   */
  clearLoginState() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userInfo');
    
    this.isLoggedIn = false;
    this.openid = null;
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
   * 获取用户openid
   * @returns {string|null} 用户openid
   */
  getOpenid() {
    return this.openid || wx.getStorageSync('openid');
  }
  
  /**
   * 获取用户信息
   * @returns {Object|null} 用户信息
   */
  getUserInfo() {
    return this.userInfo || wx.getStorageSync('userInfo');
  }
  
  /**
   * 请求用户授权并获取用户信息
   * @returns {Promise} 用户信息
   */
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: res => {
          // 保存用户信息
          this.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          resolve(res.userInfo);
        },
        fail: err => {
          console.error('获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  }
}

// 创建单例实例
const loginService = new LoginService();

// 使用微信小程序支持的模块导出方式
module.exports = {
  login: loginService.login.bind(loginService),
  wxLogin: loginService.wxLogin.bind(loginService),
  getUserProfile: loginService.getUserProfile.bind(loginService),
  getOpenid: loginService.getOpenid.bind(loginService),
  getUserInfo: loginService.getUserInfo.bind(loginService),
  getLoginStatus: loginService.getLoginStatus.bind(loginService),
  clearLoginState: loginService.clearLoginState.bind(loginService),
  checkLoginStatus: loginService.checkLoginStatus.bind(loginService)
}; 