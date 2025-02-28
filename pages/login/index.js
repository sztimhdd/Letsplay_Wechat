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
    this.setData({ isLoading: true });
    
    try {
        const loginResult = await loginService.login();
        
        if (loginResult.success) {
            if (loginResult.needMatch) {
                console.log('需要进行用户匹配');
                this.setData({ isLoading: false });
                return;
            }
            
            console.log('登录成功，使用默认用户信息');
            
            // 使用新的统一方法更新用户表
            try {
                const sheetData = await sheetsAPI.loadAllSheetData();
                if (!sheetData.users[loginResult.wechatId]) {
                    await sheetsAPI.createNewUser({
                        wechatId: loginResult.wechatId,
                        openid: loginResult.openid
                    });
                }
                console.log('用户表更新成功');
            } catch (err) {
                console.error('用户表更新失败:', err);
            }
            
            // 设置全局用户信息
            app.globalData.userInfo = DEFAULT_USER;
            app.globalData.hasLogin = true;
            
            this.navigateToIndex();
        } else {
            wx.showToast({
                title: loginResult.error || '登录失败，请重试',
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

  // 跳转到首页
  navigateToIndex() {
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }, 1000);
  }
}); 