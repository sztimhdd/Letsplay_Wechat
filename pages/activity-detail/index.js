const { users: mockUsers } = require('../../mock/users');
const app = getApp();
import { signUpService } from '../../services/signup-service';

Page({
  data: {
    activity: null,  // 当前显示的活动
    canSignUp: false,
    hasJoined: false,
    statusBarHeight: 20,
    showAdminPanel: false,
    adminUnlocked: false,
    adminPassword: '',  // 确保在data中定义了adminPassword字段
    loading: true,
    perPersonFee: '0.00'
  },

  async onLoad(options) {
    try {
      const { id } = options;
      const windowInfo = wx.getWindowInfo();
      
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight,
        loading: true
      });

      try {
        wx.showLoading({ title: '加载中...' });
        await app.refreshActivities();
        
        // 获取活动数据
        const activity = app.getActivityById(id);
        
        if (!activity) {
          throw new Error('活动不存在');
        }

        // 检查是否可以取消报名（活动开始前2小时内不能取消）
        let canCancel = false;
        try {
          const activityDate = new Date(activity.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2'));
          const [startTime] = activity.startTime.split('-');
          const [hours, minutes] = startTime.split(':');
          
          activityDate.setHours(parseInt(hours), parseInt(minutes));
          
          const now = new Date();
          const timeUntilStart = activityDate.getTime() - now.getTime();
          canCancel = timeUntilStart >= 2 * 60 * 60 * 1000; // 2小时
        } catch (err) {
          console.error('时间处理错误:', err);
          canCancel = false;
        }

        // 检查当前用户是否已报名
        const currentUser = await app.getCurrentUser();
        const hasJoined = currentUser && activity.participants?.some(p => p.wechat === currentUser.wechat);

        // 添加状态文本
        activity.statusText = this.getStatusText(activity.status);

        this.setData({
          activity,
          loading: false,
          hasJoined,
          canCancel,
          canSignUp: activity.status === 'upcoming' && !hasJoined
        });

        // 加载参与者信息
        await this.loadParticipants();

      } catch (err) {
        console.error('加载活动详情失败:', err);
        wx.showToast({
          title: err.message || '加载失败',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
      }
    } catch (err) {
      console.error('页面加载失败:', err);
    }
  },

  getActivityDetail: function(id) {
    // 从本地存储获取活动数据
    const activities = wx.getStorageSync('activities') || [];
    const activity = activities.find(a => a.id === Number(id));
    
    if (activity) {
      // 确保 currentMembers 与 participants 数组长度一致
      activity.currentMembers = activity.participants.length;
      
      this.setData({ activity: activity }, () => {
        this.checkUserStatus(id);
        this.calculateAAPrice();
        this.checkActivityStatus();
        this.loadParticipants();
      });
    }
  },

  checkUserStatus: function(activityId) {
    // 检查是否已报名
    var hasJoined = this.data.activity.participants.some(function(p) {
      return p.name === '我';
    });
    
    // 检查活动是否已结束
    var isCompleted = this.data.activity.status === 'completed';
    
    this.setData({
      hasJoined: hasJoined && !isCompleted
    });
  },

  joinActivity: function() {
    if (this.data.activity.isFull || this.data.activity.status === 'completed') return;

    wx.showModal({
      title: '确认报名',
      content: '报名后每人需支付 ¥' + this.data.activity.price + '，是否确认报名？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '报名中' });
          
          setTimeout(() => {
            wx.hideLoading();
            
            // 创建新的参与者列表
            const newParticipants = this.data.activity.participants.concat([{
              id: Date.now(),
              name: '我',
              avatar: '../../assets/images/avatars/default.png'
            }]);

            // 更新活动数据
            const updatedActivity = Object.assign({}, this.data.activity, {
              currentMembers: this.data.activity.currentMembers + 1,
              participants: newParticipants
            });

            // 更新按钮状态和活动数据
            this.setData({
              hasJoined: true,
              activity: updatedActivity
            });
            this.calculateAAPrice();

            // 更新本地存储
            var myActivities = wx.getStorageSync('myActivities') || [];
            var existingIndex = myActivities.findIndex(function(a) {
              return a.id === this.data.activity.id;
            });
            
            if (existingIndex >= 0) {
              myActivities[existingIndex] = updatedActivity;
            } else {
              myActivities.push(updatedActivity);
            }
            
            wx.setStorageSync('myActivities', myActivities);

            // 更新我的活动页面
            var pages = getCurrentPages();
            var myActivitiesPage = pages.find(function(page) {
              return page.route === 'pages/my-activities/index';
            });
            
            if (myActivitiesPage) {
              myActivitiesPage.onLoad();
            }

            wx.showToast({
              title: '报名成功',
              icon: 'success',
              duration: 1500
            });
          }, 1000);
        }
      }
    });
  },

  handleImageError: function(e) {
    const type = e.currentTarget.dataset.type;
    const defaultImage = type === 'cover' 
      ? '../../assets/images/covers/default.webp'  // 默认封面图
      : '../../assets/images/avatars/default.png'; // 默认头像

    if (type === 'cover') {
      this.setData({ 'activity.coverImage': defaultImage });
    } else {
      const index = e.currentTarget.dataset.index;
      const path = `activity.participants[${index}].avatar`;
      this.setData({
        [path]: defaultImage
      });
    }
  },

  goBack() {
    // 如果有上一页，返回上一页
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1
      });
    } else {
      // 如果没有上一页，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  async onPullDownRefresh() {
    try {
      await app.refreshActivities();
      const activity = app.getActivityById(this.data.activity.id);
      if (activity) {
        this.setData({ activity });
        this.loadParticipants();
      }
    } catch (err) {
      console.error('刷新数据失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  previewImage: function(e) {
    var url = e.currentTarget.dataset.url;
    wx.previewImage({ 
      urls: [url], 
      current: url 
    });
  },

  viewUserProfile: function(e) {
    var userid = e.currentTarget.dataset.userid;
    wx.navigateTo({ 
      url: '/pages/user-detail/index?id=' + userid 
    });
  },

  onShareAppMessage: function() {
    var activity = this.data.activity;
    return {
      title: activity.title,
      imageUrl: activity.coverImage,
      path: '/pages/activity-detail/index?id=' + activity.id
    };
  },

  cancelJoin: function() {
    if (this.data.activity.status === 'completed') {
      wx.showToast({
        title: '已结束活动不能取消',
        icon: 'none'
      });
      return;
    }

    var self = this;
    wx.showModal({
      title: '确认取消',
      content: '确定要取消报名吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '取消中' });
          
          setTimeout(function() {
            wx.hideLoading();
            
            self.setData({
              hasJoined: false,
              'activity.currentMembers': self.data.activity.currentMembers - 1,
              'activity.participants': self.data.activity.participants.filter(function(p) {
                return p.name !== '我';
              })
            });

            var myActivities = wx.getStorageSync('myActivities') || [];
            var updatedActivities = myActivities.filter(function(a) {
              return a.id !== self.data.activity.id;
            });
            wx.setStorageSync('myActivities', updatedActivities);

            self.calculateAAPrice();

            wx.showToast({
              title: '已取消报名',
              icon: 'success',
              duration: 1500
            });
          }, 1000);
        }
      }
    });
  },

  // 添加计算AA费用的方法
  calculateAAPrice: function() {
    var activity = this.data.activity;
    var totalPrice = activity.totalPrice;
    var currentMembers = activity.currentMembers;
    var aaPrice = Math.ceil(totalPrice / (currentMembers + 1));
    this.setData({
      'activity.price': aaPrice
    });
  },

  // 添加检查活动状态的方法
  checkActivityStatus: function() {
    const now = new Date();
    const activityDate = new Date(this.data.activity.date.replace(/-/g, '/'));
    
    // 设置活动的开始和结束时间
    const startTimeArr = this.data.activity.startTime.split(':');
    const endTimeArr = this.data.activity.endTime.split(':');
    
    const startTime = new Date(activityDate);
    startTime.setHours(startTimeArr[0], startTimeArr[1], 0);
    
    const endTime = new Date(activityDate);
    endTime.setHours(endTimeArr[0], endTimeArr[1], 0);

    let status = 'upcoming';
    
    if (now < startTime) {
      status = 'upcoming';
    } else if (now >= startTime && now <= endTime) {
      status = 'ongoing';
    } else {
      status = 'completed';
    }

    this.setData({
      'activity.status': status
    });
  },

  // 显示管理员面板
  showAdminPanel: function() {
    if (!this.data.adminUnlocked) {
      this.verifyAdminPassword();
      return;
    }
    this.setData({ showAdminPanel: true });
  },

  // 验证管理员密码
  verifyAdminPassword: function() {
    const self = this;
    wx.showModal({
      title: '管理员验证',
      content: '',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content === '1') {
          wx.setStorageSync('adminAuth', Date.now() + 3600000)
          self.setData({ 
            adminUnlocked: true,
            showAdminPanel: true
          })
        } else if (res.confirm) {
          wx.showToast({
            title: '密码错误',
            icon: 'none'
          });
        }
      },
      complete: () => {
        // 清空输入框内容
        self.setData({
          adminPassword: ''  // 确保在data中定义了adminPassword字段
        });
      }
    })
  },

  // 检查管理员权限
  checkAdminAuth: function() {
    const authTime = wx.getStorageSync('adminAuth')
    if (authTime && authTime > Date.now()) {
      this.setData({ adminUnlocked: true })
    }
  },

  handleAdminAction: function() {
    if (!this.data.adminUnlocked) {
      this.verifyAdminPassword();
    } else {
      // 切换管理员面板的显示状态
      this.setData({ 
        showAdminPanel: !this.data.showAdminPanel 
      });
    }
  },

  async cancelActivity() {
    const { activity } = this.data;
    if (!activity) return;

    this.setData({ showAdminPanel: false });  // 隐藏面板

    // 检查活动是否已结束
    if (activity.status === 'completed') {
      wx.showToast({
        title: '已结束活动不能取消',
        icon: 'none'
      });
      return;
    }

    // 弹出确认框
    const confirmResult = await new Promise(resolve => {
      wx.showModal({
        title: '确认取消',
        content: '确定要永久取消该活动吗？',
        success: resolve
      });
    });

    if (!confirmResult.confirm) return;

    try {
      wx.showLoading({ title: '正在取消活动...' });

      // 1. 更新 Google Sheets 中的活动状态
      await signUpService.cancelActivity(activity.column);

      // 2. 更新本地存储
      let activities = wx.getStorageSync('activities') || [];
      activities = activities.filter(a => a.id !== activity.id);
      wx.setStorageSync('activities', activities);
      
      let myActivities = wx.getStorageSync('myActivities') || [];
      myActivities = myActivities.filter(a => a.id !== activity.id);
      wx.setStorageSync('myActivities', myActivities);

      // 3. 刷新全局活动数据
      await app.refreshActivities();

      wx.showToast({ 
        title: '活动已取消',
        icon: 'success'
      });

      // 返回上一页
      wx.navigateBack();

    } catch (err) {
      console.error('取消活动失败:', err);
      wx.showToast({
        title: '取消失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  goToSettlement: function() {
    console.log('赛后结算按钮被点击');
    wx.navigateTo({
      url: '/pages/check-in/index?id=' + this.data.activity.id
    });
  },

  // 添加更新签到人数的方法
  updateCheckInCount: function() {
    const { participants } = this.data;
    if (!participants) return;
    
    this.setData({
      checkedInCount: participants.length,  // 所有参与者都视为已签到
      totalParticipants: participants.length
    });
  },

  onShow: function() {
    // 每次页面显示时更新活动状态
    if (this.data.activity) {
      // 重新获取最新活动数据
      const activities = wx.getStorageSync('activities') || [];
      const activity = activities.find(a => a.id === this.data.activity.id);
      if (activity) {
        this.setData({ 
          activity: activity,
          // 更新管理员操作按钮状态
          canSettle: activity.status !== 'completed'
        });
      }
      this.updateCheckInCount();
    }
  },

  // 处理管理员签到操作
  handleAdminCheckIn: function() {
    const { activity } = this.data;
    if (!activity) return;

    // 检查活动状态和报名人数
    if (!activity.participants?.length) {
      wx.showToast({
        title: '暂无报名人员',
        icon: 'none'
      });
      return;
    }

    if (activity.status !== 'completed') {
      wx.showToast({
        title: '活动未结束',
        icon: 'none'
      });
      return;
    }

    this.setData({ showAdminPanel: false });  // 隐藏面板

    // 跳转到签到页面
    wx.navigateTo({
      url: `/pages/check-in/index?id=${activity.id}&column=${activity.column}`,
      fail: (err) => {
        console.error('跳转签到页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载参与者信息
  async loadParticipants() {
    try {
      const { activity } = this.data;
      if (!activity?.participants) return;

      // 处理参与者数据，添加默认头像和状态
      const participants = activity.participants.map(p => ({
        ...p,
        avatar: '/assets/images/avatars/default.png',
        status: '已签到',  // 默认状态
        fee: activity.perPersonFee  // 使用活动的人均费用
      }));

      this.setData({
        participants,
        checkedInCount: participants.length,
        totalParticipants: activity.maxParticipants
      });

      console.log('参与者信息已加载:', {
        total: participants.length,
        maxParticipants: activity.maxParticipants,
        participants
      });

    } catch (err) {
      console.error('加载参与者信息失败:', err);
      wx.showToast({
        title: '加载参与者失败',
        icon: 'none'
      });
    }
  },

  // 更新报名方法
  async onSignUp() {
    try {
      // 检查活动状态
      if (this.data.activity.status === 'completed') {
        throw new Error('活动已结束');
      }

      if (this.data.activity.isFull && !this.data.hasJoined) {
        throw new Error('活动已满员');
      }

      // 如果已报名，则执行取消报名
      if (this.data.hasJoined) {
        await this.cancelSignUp();
        return;
      }

      // 获取活动列并添加日志
      const { activity } = this.data;
      console.log('报名时的完整活动数据:', activity);

      if (!activity.column) {
        console.error('缺少列标识:', {
          id: activity.id,
          field: activity.field,
          column: activity.column
        });
        throw new Error('活动信息不完整');
      }

      wx.showLoading({ title: '报名中' });
      const result = await signUpService.signUp(activity.column);

      if (result.success) {
        wx.showToast({
          title: '报名成功',
          icon: 'success',
          duration: 2000
        });

        // 刷新页面数据
        setTimeout(async () => {
          await this.refreshData();
        }, 2000);
      }

    } catch (err) {
      console.error('报名失败:', err);
      wx.showToast({
        title: err.message || '报名失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 取消报名
  async cancelSignUp() {
    try {
      if (this.data.activity.status === 'completed') {
        throw new Error('已结束活动不能取消');
      }

      if (!this.data.canCancel) {
        throw new Error('活动开始前2小时内不能取消报名');
      }

      const confirmResult = await new Promise(resolve => {
        wx.showModal({
          title: '确认取消',
          content: '确定要取消报名吗？',
          success: resolve
        });
      });

      if (!confirmResult.confirm) {
        return;
      }

      wx.showLoading({ title: '取消中' });

      // 执行取消报名
      const result = await signUpService.cancelSignUp(this.data.activity.column);

      if (result.success) {
        wx.showToast({
          title: '已取消报名',
          icon: 'success',
          duration: 1500
        });

        // 刷新页面数据
        await this.refreshData();
      } else {
        throw new Error('取消报名失败');
      }

    } catch (err) {
      console.error('取消报名失败:', err);
      wx.showToast({
        title: err.message || '取消失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 刷新页面数据
  async refreshData() {
    try {
      await app.refreshActivities();
      const activity = app.getActivityById(this.data.activity.id);
      if (activity) {
        // 检查当前用户是否已报名
        const currentUser = await app.getCurrentUser();
        const hasJoined = currentUser && activity.participants?.some(p => p.wechat === currentUser.wechat);

        this.setData({ 
          activity,
          hasJoined
        });

        // 更新参与者列表
        this.loadParticipants();
      }
    } catch (err) {
      console.error('刷新数据失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    }
  },

  // 获取活动状态文本
  getStatusText(status) {
    const statusMap = {
      upcoming: '即将开始',
      ongoing: '进行中',
      completed: '已结束',
      cancelled: '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  // 在页面隐藏时关闭管理员面板
  onHide: function() {
    this.setData({ showAdminPanel: false });
  }
}); 