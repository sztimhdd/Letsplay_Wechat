const { sheetsAPI } = require('../../utils/sheets-api');
const loginService = require('../../utils/login-service');
const app = getApp();

Page({
  data: {
    wechatId: '',
    suggestedUsers: [],
    isSearching: false,
    openid: '',
    searchStatus: '', // 'initial', 'searching', 'found', 'not_found'
    searchMessage: ''
  },

  onLoad() {
    // 获取 OpenID
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      console.error('未找到OpenID，需要重新登录');
      wx.showToast({
        title: '登录状态异常',
        icon: 'none'
      });
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/login/index',
          fail: (err) => {
            console.error('跳转到登录页面失败:', err);
            // 尝试使用navigateTo
            wx.navigateTo({
              url: '/pages/login/index',
              fail: (err2) => {
                console.error('navigateTo到登录页面也失败:', err2);
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
      }, 1500);
      return;
    }
    
    this.setData({ 
      openid,
      searchStatus: 'initial',
      searchMessage: '请输入您的微信名称以匹配已有用户'
    });
    
    // 检查sheetsAPI是否可用
    if (!sheetsAPI) {
      console.error('sheetsAPI 未定义，可能是模块加载失败');
      wx.showToast({
        title: '系统初始化失败',
        icon: 'none'
      });
      return;
    }
    
    // 初始化 sheetsAPI
    sheetsAPI.initialize().then(() => {
      console.log('sheetsAPI 初始化完成');
    }).catch(err => {
      console.error('sheetsAPI 初始化失败:', err);
      wx.showToast({
        title: '初始化失败，请重试',
        icon: 'none'
      });
    });
  },

  // 处理输入
  handleInput(e) {
    const value = e.detail.value;
    
    this.setData({ 
      wechatId: value,
      isSearching: true,
      searchStatus: 'searching'
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
        isSearching: false,
        searchStatus: 'initial',
        searchMessage: '请输入您的微信名称以匹配已有用户'
      });
      return;
    }

    try {
      this.setData({
        searchStatus: 'searching',
        searchMessage: '正在搜索...'
      });
      
      // 加载所有用户数据
      await sheetsAPI.initialize();
      
      // 从Record表中查找用户
      const recordRange = 'Record!A9:B200';  // A列是姓名拼音，B列是微信名称
      const recordData = await sheetsAPI.readSheet(recordRange);
      
      console.log('读取到的用户数据:', {
        total: recordData?.values?.length || 0,
        sample: recordData?.values?.slice(0, 5) || []
      });
      
      // 处理用户数据
      const users = [];
      if (recordData && recordData.values) {
        // 遍历所有用户，查找名称中包含关键词的用户
        recordData.values.forEach(row => {
          if (row.length >= 2 && row[0] && row[1]) {
            const pinyinName = row[0];  // 姓名拼音
            const wechatName = row[1];  // 微信名称
            
            // 如果微信名称包含关键词（不区分大小写），则添加到结果中
            if (wechatName.toLowerCase().includes(keyword.toLowerCase())) {
              users.push({
                name: wechatName,
                pinyinName: pinyinName,
                wechatId: wechatName,  // 使用微信名称作为ID
                balance: '查询中...'  // 稍后会更新余额
              });
            }
          }
        });
        
        // 如果找到了用户，查询他们的余额
        if (users.length > 0) {
          // 读取余额数据
          const balanceRange = 'Record!A9:D200';  // D列是余额
          const balanceData = await sheetsAPI.readSheet(balanceRange);
          
          if (balanceData && balanceData.values) {
            // 更新用户余额
            users.forEach(user => {
              const userRow = balanceData.values.find(row => row.length >= 2 && row[1] === user.name);
              if (userRow && userRow.length >= 4) {
                user.balance = userRow[3] || '0.00';
              } else {
                user.balance = '0.00';
              }
            });
          }
        }
      }

      this.setData({
        suggestedUsers: users,
        isSearching: false,
        searchStatus: users.length > 0 ? 'found' : 'not_found',
        searchMessage: users.length > 0 
          ? `找到 ${users.length} 个匹配用户` 
          : '未找到匹配用户，您可以创建新用户'
      });
    } catch (err) {
      console.error('搜索用户失败:', err);
      this.setData({ 
        isSearching: false,
        searchStatus: 'error',
        searchMessage: '搜索失败，请重试'
      });
    }
  },

  // 选择已有用户
  async selectUser(e) {
    const { user } = e.currentTarget.dataset;
    try {
      wx.showLoading({ title: '正在绑定...' });
      
      // 更新用户的 OpenID
      await sheetsAPI.updateUserOpenId(user.name, this.data.openid);
      
      // 保存微信名称
      wx.setStorageSync('wechatId', user.name);
      
      // 获取完整的用户信息
      const userInfo = await sheetsAPI.getUserFullInfo(user.name);
      
      // 创建完整的用户信息对象
      const fullUserInfo = {
        openid: this.data.openid,
        wechatId: user.name,
        name: user.name,
        pinyinName: user.pinyinName || '',
        balance: user.balance || '0.00',
        needMatch: false
      };
      
      // 保存登录状态
      loginService.saveLoginState(fullUserInfo);
      
      // 设置全局登录状态
      app.globalData.hasLogin = true;
      app.globalData.userInfo = fullUserInfo;
      
      wx.hideLoading();
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
      wx.hideLoading();
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
        title: '请输入微信名称',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '正在创建...' });
      
      // 创建新用户数据
      const userData = {
        name: this.data.wechatId,  // 使用输入的名称作为微信名称
        wechatId: this.data.wechatId,  // 微信名称就是微信ID
        pinyinName: '',  // 拼音名称暂时留空
        openid: this.data.openid,
        balance: '0.00'
      };
      
      // 创建新用户
      await sheetsAPI.createNewUser(userData);
      
      // 保存微信名称
      wx.setStorageSync('wechatId', userData.wechatId);
      
      // 创建完整的用户信息对象
      const fullUserInfo = {
        openid: this.data.openid,
        wechatId: userData.wechatId,
        name: userData.name,
        pinyinName: userData.pinyinName,
        balance: '0.00',
        needMatch: false
      };
      
      // 保存登录状态
      loginService.saveLoginState(fullUserInfo);
      
      // 设置全局登录状态
      app.globalData.hasLogin = true;
      app.globalData.userInfo = fullUserInfo;
      
      wx.hideLoading();
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
      wx.hideLoading();
      console.error('创建用户失败:', err);
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    }
  }
}); 