// index.js
const loginService = require('../../utils/login-service');
const { sheetsAPI } = require('../../utils/sheets-api');
const app = getApp();

Page({
  data: {
    activities: [],
    isLoading: true,
    isLoggedIn: false,
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    showLoginModal: false,
    activityListRect: null,
    scrollPosition: {
      scrollTop: 0,
      scrollHeight: 0
    }
  },

  async onLoad() {
    console.log('首页开始加载...');
    try {
      // 1. 检查登录状态
      try {
        console.log('开始检查登录状态...');
        loginService.checkPageLogin();
        console.log('登录状态检查通过');
      } catch (loginErr) {
        console.log('登录检查结果:', loginErr.message);
        // 登录检查抛出的错误表示重定向已经被触发，我们只需要返回
        this.setData({ isLoading: false });
        return;
      }
      
      // 如果代码执行到这里，说明用户已登录且不需要匹配
      const isLoggedIn = true;
      const userInfo = loginService.getUserInfo();
      console.log('获取到用户信息:', userInfo);

      this.setData({
        isLoggedIn,
        userInfo,
        hasUserInfo: !!userInfo
      });

      // 2. 检查并初始化 sheetsAPI
      console.log('开始检查sheetsAPI...');
      if (!sheetsAPI) {
        console.error('sheetsAPI 未定义，可能是模块加载失败');
        wx.showToast({
          title: '系统初始化失败',
          icon: 'none'
        });
        return;
      }
      
      // 确保sheetsAPI存在且有initialize方法
      if (typeof sheetsAPI.initialize === 'function') {
        console.log('开始初始化sheetsAPI...');
        await sheetsAPI.initialize();
        console.log('sheetsAPI初始化完成');
      } else {
        console.error('sheetsAPI.initialize 不是一个函数');
        wx.showToast({
          title: '系统初始化失败',
          icon: 'none'
        });
        return;
      }

      // 3. 加载活动列表
      console.log('开始加载活动列表...');
      await this.loadActivities();
      console.log('活动列表加载完成，数据条数:', this.data.activities.length);

    } catch (err) {
      console.error('页面加载失败:', err);
      wx.showToast({
        title: '加载失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
      console.log('首页加载完成，isLoading设置为false');
    }
  },

  async loadActivities() {
    try {
      console.log('loadActivities: 开始加载活动列表...');
      this.setData({ isLoading: true });

      // 检查sheetsAPI是否可用
      if (!sheetsAPI || typeof sheetsAPI.getActivities !== 'function') {
        console.error('sheetsAPI 不可用或者 getActivities 方法不存在');
        this.setData({
          activities: [],
          isLoading: false
        });
        wx.showToast({
          title: '无法加载活动列表',
          icon: 'none'
        });
        return;
      }

      console.log('loadActivities: 调用sheetsAPI.getActivities...');
      // 获取活动列表
      const activities = await sheetsAPI.getActivities({
        limit: 20,
        includeDetails: true
      });

      console.log('获取到的活动列表:', {
        total: activities.length,
        sample: activities[0]
      });

      // 确保activities是数组
      if (!Array.isArray(activities)) {
        console.error('获取到的activities不是数组:', activities);
        this.setData({
          activities: [],
          isLoading: false
        });
        return;
      }

      console.log('loadActivities: 更新页面数据，活动数量:', activities.length);
      this.setData({
        activities,
        isLoading: false
      });

      // 更新全局活动数据
      app.globalData.activities = activities;
      app.globalData.activitiesLoaded = true;
      console.log('loadActivities: 全局活动数据已更新');

    } catch (err) {
      console.error('加载活动列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    }
  },

  // 点击活动卡片
  onActivityTap(e) {
    const { id } = e.detail;
    wx.navigateTo({
      url: `/pages/activity-detail/index?id=${id}`
    });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    try {
      await this.loadActivities();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 获取活动列表位置信息
  async getActivityListRect() {
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery();
      query.select('#activity-list').boundingClientRect();
      query.exec((res) => {
        if (res && res[0]) {
          console.log('活动列表位置和尺寸:', res[0]);
          this.setData({ activityListRect: res[0] });
          resolve(res[0]);
        } else {
          resolve(null);
        }
      });
    });
  },

  // 监听页面滚动
  onPageScroll(e) {
    //console.log('页面滚动位置:', e);
    this.setData({
      scrollPosition: e
    });
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
      
      // 检查全局app和refreshActivities方法是否可用
      if (!app || typeof app.refreshActivities !== 'function') {
        console.error('app.refreshActivities 方法不可用');
        wx.showToast({
          title: '刷新功能暂不可用',
          icon: 'none'
        });
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
        return;
      }
      
      // 刷新全局数据
      await app.refreshActivities();
      
      // 直接使用刷新后的数据
      this.setData({
        activities: app.globalData.activities || [],
        loading: false
      });

      // 如果是下拉刷新触发的，停止下拉动画
      wx.stopPullDownRefresh();
    } catch (err) {
      console.error('刷新数据失败:', err);
      wx.showToast({
        title: '刷新失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
