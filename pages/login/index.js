const app = getApp();
const loginService = require('../../utils/login-service');

// 定义默认用户信息
const DEFAULT_USER = {
  nickName: '微信用户',
  avatarUrl: '/assets/icons/default-avatar.png'
};

Page({
  data: {
    isLoading: false,
    loginStep: 'login', // 'login' 或 'complete'
    isLoggedIn: false,
    userInfo: null
  },

  onLoad() {
    // 检查登录状态
    const isLoggedIn = loginService.checkLoginStatus();
    if (isLoggedIn) {
      const userInfo = loginService.getUserInfo();
      if (userInfo) {
        this.setData({
          isLoggedIn: true,
          userInfo,
          loginStep: 'complete'
        });
        this.navigateToIndex();
      }
    }
  },

  // 处理微信登录
  async handleLogin() {
    try {
      wx.showLoading({ title: '登录中...' });
      
      // 1. 获取登录凭证
      const { code } = await wx.login();
      
      // 2. 执行登录
      const userInfo = await loginService.handleLogin(code);
      
      // 3. 更新全局状态
      app.globalData.userInfo = userInfo;
      app.globalData.hasLogin = true;

      // 4. 更新页面状态
      this.setData({
        isLoggedIn: true,
        userInfo,
        loginStep: 'complete'
      });

      // 5. 延迟跳转
      setTimeout(() => this.navigateToIndex(), 1500);

    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({
        title: err.message || '登录失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 跳转到首页
  navigateToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
}); 