const { sheetsAPI } = require('../../utils/sheets-api');
const loginService = require('../../utils/login-service');
const app = getApp();

Page({
  data: {
    wechatId: '',
    suggestedUsers: [],
    isSearching: false,
    openid: ''
  },

  onLoad() {
    // 获取 OpenID
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '登录状态异常',
        icon: 'none'
      });
      return;
    }
    this.setData({ openid });
  },

  // 处理输入
  handleInput(e) {
    const value = e.detail.value;
    
    this.setData({ 
      wechatId: value,
      isSearching: true 
    });
    
    // 使用防抖进行搜索
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    this.searchTimer = setTimeout(() => {
      this.searchUsers(value);
    }, 500);  // 500ms 防抖
  },

  // 搜索用户
  async searchUsers(keyword) {
    if (!keyword) {
      this.setData({
        suggestedUsers: [],
        isSearching: false
      });
      return;
    }

    try {
      // 使用缓存数据搜索用户
      const sheetData = await sheetsAPI.loadAllSheetData();
      const users = Object.entries(sheetData.users)
        .filter(([wechatId]) => wechatId.toLowerCase().includes(keyword.toLowerCase()))
        .map(([wechatId, userData]) => ({
          wechatId,
          balance: userData.balance || '0.00'
        }));

      this.setData({
        suggestedUsers: users,
        isSearching: false
      });
    } catch (err) {
      console.error('搜索用户失败:', err);
      this.setData({ isSearching: false });
    }
  },

  // 选择已有用户
  async selectUser(e) {
    const { user } = e.currentTarget.dataset;
    try {
      // 更新用户的 OpenID
      await sheetsAPI.updateUserOpenId(user.wechatId, this.data.openid);
      
      // 保存微信号
      wx.setStorageSync('wechatId', user.wechatId);
      
      // 获取当前的登录凭证
      const loginResult = await loginService.wxLogin();
      if (loginResult.code) {
        // 保存登录状态
        loginService.saveLoginState(loginResult.code);
        
        // 设置全局登录状态
        app.globalData.hasLogin = true;
        app.globalData.userInfo = {
          wechatId: user.wechatId,
          openid: this.data.openid
        };
      }
      
      wx.showToast({
        title: '绑定成功',
        icon: 'success'
      });
      
      // 返回首页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);
    } catch (err) {
      console.error('绑定用户失败:', err);
      wx.showToast({
        title: '绑定失败',
        icon: 'none'
      });
    }
  },

  // 创建新用户
  async createNewUser() {
    if (!this.data.wechatId) {
      wx.showToast({
        title: '请输入微信号',
        icon: 'none'
      });
      return;
    }

    try {
      await sheetsAPI.createNewUser({
        wechatId: this.data.wechatId,
        openid: this.data.openid
      });
      
      wx.setStorageSync('wechatId', this.data.wechatId);
      
      const loginResult = await loginService.wxLogin();
      if (loginResult.code) {
        loginService.saveLoginState(loginResult.code);
        
        app.globalData.hasLogin = true;
        app.globalData.userInfo = {
          wechatId: this.data.wechatId,
          openid: this.data.openid
        };
      }
      
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });
      
      // 返回首页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);
    } catch (err) {
      console.error('创建用户失败:', err);
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    }
  }
}); 