// index.js
const app = getApp();
const loginService = require('../../utils/login-service');

Page({
  data: {
    activities: [],
    loading: true,
    statusBarHeight: 20,
    navPlaceholderHeight: 30
  },

  async onLoad() {
    // 获取系统状态栏高度
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navPlaceholderHeight: windowInfo.statusBarHeight + 10 // 状态栏高度加10px作为占位
    });

    // 检查登录状态
    const isLoggedIn = this.checkLoginStatus();
    
    // 如果未登录，等待登录页面处理
    if (!isLoggedIn) {
      return;
    }

    // 如果活动数据已加载，直接使用
    if (app.globalData.activitiesLoaded) {
      const activities = app.globalData.activities.map(activity => ({
        ...activity,
        perPersonFee: parseFloat(activity.perPersonFee).toFixed(2)
      }));
      
      this.setData({
        activities,
        loading: false
      });
    } else {
      // 等待数据加载完成
      await this.loadActivities();
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = loginService.checkLoginStatus();
    
    if (!isLoggedIn) {
      console.log('用户未登录，跳转到登录页面');
      wx.navigateTo({
        url: '/pages/login/index'
      });
      return false;
    } else {
      const userInfo = loginService.getUserInfo();
      if (userInfo) {
        app.globalData.userInfo = userInfo;
        app.globalData.hasLogin = true;
      } else {
        console.log('已登录但无用户信息，需要获取用户信息');
      }
      return true;
    }
  },

  async onShow() {
    // 等待页面渲染完成
    await new Promise(resolve => {
      setTimeout(() => {
        this.getElementInfo();
        resolve();
      }, 300); // 增加延时确保元素已渲染
    });
  },

  async onPullDownRefresh() {
    await this.refreshData();
  },

  async loadActivities() {
    wx.showLoading({ title: '加载中' });
    try {
      while (!app.globalData.activitiesLoaded) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 直接使用全局活动数据，无需额外处理
      this.setData({
        activities: app.globalData.activities,
        loading: false
      });

    } catch (err) {
      console.error('加载活动列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  onSearch: function(e) {
    var keyword = e.detail.value;
    // TODO: 实现搜索功能
    console.log('搜索关键词:', keyword);
  },

  createActivity: function() {
    wx.showToast({
      title: '创建活动功能开发中',
      icon: 'none'
    });
  },

  showAdminPanel: function() {
    const authTime = wx.getStorageSync('adminAuth');
    if (!authTime || authTime < Date.now()) {
      wx.showModal({
        title: '管理员验证',
        content: '请输入管理员密码',
        editable: true,
        success: (res) => {
          if (res.confirm && res.content === '123456') {
            wx.setStorageSync('adminAuth', Date.now() + 3600000)
            wx.navigateTo({ url: '/pages/create-activity/index' })
          }
        }
      })
    } else {
      wx.navigateTo({ url: '/pages/create-activity/index' })
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/activity-detail/index?id=' + id
    });
  },

  goToCreateActivity() {
    console.log('准备跳转到创建活动页面');
    const authTime = wx.getStorageSync('adminAuth');
    if (!authTime || authTime < Date.now()) {
      wx.showModal({
        title: '管理员验证',
        placeholderText: '请输入管理员密码',
        editable: true,
        success: (res) => {
          if (res.confirm && res.content === '1') {
            wx.setStorageSync('adminAuth', Date.now() + 3600000);
            wx.navigateTo({
              url: '/pages/create-activity/index',
              fail: (err) => {
                console.error('跳转失败:', err);
                wx.showToast({
                  title: '跳转失败',
                  icon: 'none'
                });
              }
            });
          } else if (res.confirm) {
            wx.showToast({
              title: '密码错误',
              icon: 'none'
            });
          }
        }
      });
    } else {
      wx.navigateTo({
        url: '/pages/create-activity/index',
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    }
  },

  // 获取元素位置和尺寸信息
  getElementInfo() {
    const query = wx.createSelectorQuery();
    
    // 查询导航栏信息
    query.select('.nav-bar').boundingClientRect(rect => {
      if (rect) {
        console.log('导航栏位置和尺寸:', {
          top: rect.top,
          height: rect.height,
          bottom: rect.bottom
        });
      }
    });
    
    // 查询活动列表信息
    query.select('.activity-list').boundingClientRect(rect => {
      if (rect) {
        console.log('活动列表位置和尺寸:', {
          top: rect.top,
          height: rect.height,
          bottom: rect.bottom
        });
      }
    });
    
    // 获取页面滚动位置
    query.selectViewport().scrollOffset(res => {
      console.log('页面滚动位置:', {
        scrollTop: res.scrollTop,
        scrollHeight: res.scrollHeight
      });
    });
    
    query.exec();
  },

  // 刷新数据
  async refreshData() {
    try {
      this.setData({ loading: true });
      
      // 刷新全局数据
      await app.refreshActivities();
      
      // 直接使用刷新后的数据
      this.setData({
        activities: app.globalData.activities,
        loading: false
      });

      // 如果是下拉刷新触发的，停止下拉动画
      wx.stopPullDownRefresh();
    } catch (err) {
      console.error('刷新数据失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
