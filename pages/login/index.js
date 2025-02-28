const app = getApp();
const loginService = require('../../utils/login-service');
const { sheetsAPI } = require('../../utils/sheets-api');

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
    userInfo: DEFAULT_USER
  },

  onLoad() {
    // 检查是否已登录
    const isLoggedIn = loginService.checkLoginStatus();
    const storedUser = loginService.getUserInfo();

    if (isLoggedIn) {
      this.setData({
        isLoggedIn: true
      });

      if (storedUser) {
        this.setData({
          userInfo: storedUser,
          loginStep: 'complete'
        });
        app.globalData.userInfo = storedUser;
        app.globalData.hasLogin = true;
        this.navigateToIndex();
      } else {
        // 登录了但没有用户信息，则直接使用默认
        this.setData({
          userInfo: DEFAULT_USER,
          loginStep: 'complete'
        });
        wx.setStorageSync('userInfo', DEFAULT_USER);
        app.globalData.userInfo = DEFAULT_USER;
        app.globalData.hasLogin = true;
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
      
      // 2. 获取用户 OpenID
      const { openid } = await loginService.getOpenId(code);
      if (!openid) {
        throw new Error('获取OpenID失败');
      }

      // 3. 查找用户信息
      const user = await loginService.findUserByOpenId(openid);
      
      if (user) {
        // 用户已存在，直接登录
        console.log('用户已存在，直接登录');
        await loginService.saveLoginState(code);
        
        // 保存用户信息到本地
        wx.setStorageSync('wechatId', user.wechatId);
        wx.setStorageSync('userInfo', user);
        
        // 跳转到首页
        wx.switchTab({
          url: '/pages/index/index'
        });
      } else {
        // 用户不存在，需要创建新用户
        console.log('用户不存在，创建新用户');
        const defaultUserInfo = {
          wechatId: 'user_' + openid.slice(-8),
          openid: openid
        };
        
        const newUser = await sheetsAPI.createNewUser(defaultUserInfo);
        
        // 保存用户信息
        wx.setStorageSync('wechatId', newUser.wechatId);
        wx.setStorageSync('userInfo', newUser);
        
        // 保存登录状态
        await loginService.saveLoginState(code);
        
        // 跳转到首页
        wx.switchTab({
          url: '/pages/index/index'
        });
      }

    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
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