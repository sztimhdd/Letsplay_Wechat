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
    } else {
      // 自动尝试登录
      this.autoLogin();
    }
  },

  // 自动登录
  async autoLogin() {
    try {
      this.setData({ isLoading: true });
      
      // 1. 获取登录凭证
      const { code } = await wx.login().catch(err => {
        console.error('获取登录凭证失败:', err);
        return { code: null };
      });
      
      if (!code) {
        console.log('无法获取登录凭证，需要用户手动登录');
        this.setData({ isLoading: false });
        return;
      }
      
      // 2. 执行登录
      console.log('开始执行登录...');
      const result = await loginService.login();
      console.log('登录结果:', result);
      
      if (result.success) {
        // 3. 更新全局状态
        app.globalData.userInfo = result.userInfo;
        app.globalData.hasLogin = true;

        // 4. 更新页面状态
        this.setData({
          isLoggedIn: true,
          userInfo: result.userInfo,
          loginStep: 'complete',
          isLoading: false
        });

        // 5. 延迟跳转
        setTimeout(() => this.navigateToIndex(), 1000);
      } else if (result.needMatch) {
        // 需要匹配用户，已经在login-service中处理了跳转
        console.log('用户需要匹配，等待跳转到匹配页面');
        this.setData({ isLoading: false });
      } else {
        console.log('自动登录失败，需要用户手动登录:', result.error);
        wx.showToast({
          title: result.error || '登录失败，请手动登录',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    } catch (err) {
      console.error('自动登录失败:', err);
      wx.showToast({
        title: '登录失败，请手动登录',
        icon: 'none'
      });
      this.setData({ isLoading: false });
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