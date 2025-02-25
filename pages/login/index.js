const app = getApp();
const loginService = require('../../utils/login-service');

Page({
  data: {
    canIUseGetUserProfile: false,
    isLoading: false,
    hasUserInfo: false,
    userInfo: null,
    loginStep: 'login', // 'login' 或 'userInfo'
    isLoggedIn: false
  },

  onLoad() {
    // 检查环境是否支持 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }

    // 检查是否已登录
    const isLoggedIn = loginService.checkLoginStatus();
    const userInfo = loginService.getUserInfo();

    if (isLoggedIn) {
      this.setData({
        isLoggedIn: true
      });
      
      if (userInfo) {
        this.setData({
          hasUserInfo: true,
          userInfo: userInfo,
          loginStep: 'complete'
        });
        
        // 已登录且有用户信息，跳转到首页
        this.navigateToIndex();
      } else {
        // 已登录但没有用户信息，显示获取用户信息按钮
        this.setData({
          loginStep: 'userInfo'
        });
      }
    }
  },

  // 处理微信登录
  async handleLogin() {
    this.setData({ isLoading: true });
    
    try {
      // 执行登录流程
      const loginResult = await loginService.login();
      
      if (loginResult.success) {
        console.log('登录成功，等待用户授权获取信息');
        
        this.setData({
          isLoggedIn: true,
          loginStep: 'userInfo',
          isLoading: false
        });
      } else {
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    } catch (err) {
      console.error('登录过程发生错误:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },

  // 获取用户信息 - 必须由用户点击触发
  getUserProfile() {
    if (!this.data.canIUseGetUserProfile) {
      wx.showToast({
        title: '您的微信版本过低，请升级后重试',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        // 保存用户信息
        const userInfo = res.userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
        this.setData({
          hasUserInfo: true,
          userInfo: userInfo,
          loginStep: 'complete',
          isLoading: false
        });
        
        // 更新全局用户信息
        app.globalData.userInfo = userInfo;
        app.globalData.hasLogin = true;
        
        // 获取用户信息成功后跳转到首页
        this.navigateToIndex();
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '获取用户信息失败，请重试',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      }
    });
  },

  // 跳过获取用户信息
  skipUserInfo() {
    wx.showModal({
      title: '提示',
      content: '跳过授权将使用默认头像和昵称，您可以稍后在"我的"页面中重新授权',
      success: (res) => {
        if (res.confirm) {
          // 使用默认用户信息
          const defaultUserInfo = {
            nickName: '微信用户',
            avatarUrl: '/assets/icons/default-avatar.png'
          };
          
          // 保存默认用户信息
          wx.setStorageSync('userInfo', defaultUserInfo);
          
          this.setData({
            hasUserInfo: true,
            userInfo: defaultUserInfo,
            loginStep: 'complete'
          });
          
          // 更新全局用户信息
          app.globalData.userInfo = defaultUserInfo;
          
          // 跳转到首页
          this.navigateToIndex();
        }
      }
    });
  },

  // 跳转到首页
  navigateToIndex() {
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }, 1000);
  }
}); 