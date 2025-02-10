const { activities } = require('../../mock/activities.js');

Page({
  data: {
    activity: null,  // 当前显示的活动
    isAdmin: false,
    canSignUp: false,
    canCheckIn: false,
    hasJoined: false,
    statusBarHeight: 20,
    hasCheckedIn: false  // 添加签到状态
  },

  onLoad(options) {
    const { id } = options;
    this.setData({
      isAdmin: wx.getStorageSync('userRole') === 'admin',
      statusBarHeight: wx.getSystemInfoSync().statusBarHeight
    });
    this.getActivityDetail(id);
  },

  getActivityDetail(id) {
    const activity = activities.find(a => a.id === Number(id));
    if (activity) {
      this.setData({ activity }, () => {
        this.checkUserStatus(id);
        this.calculateAAPrice();
        this.checkActivityStatus();
      });
    }
  },

  checkUserStatus(activityId) {
    const myActivities = wx.getStorageSync('myActivities') || [];
    const activity = myActivities.find(a => a.id === Number(activityId));
    
    if (activity) {
      const isCompleted = this.data.activity.status === 'completed';
      const participant = this.data.activity.participants.find(p => p.name === '我');
      
      this.setData({
        hasJoined: !isCompleted && true,
        canCheckIn: !isCompleted && this.isToday(activity.date) && this.canCheckInNow(activity.date, activity.startTime),
        hasCheckedIn: participant?.hasCheckedIn || false  // 设置签到状态
      });
    }
  },

  isToday(dateStr) {
    const today = new Date();
    const activityDate = new Date(dateStr);
    return today.toDateString() === activityDate.toDateString();
  },

  // 添加检查是否可以签到的方法
  canCheckInNow(dateStr, startTime) {
    const now = new Date();
    const activityDate = new Date(dateStr);
    const [hours, minutes] = startTime.split(':').map(Number);
    const checkInTime = new Date(activityDate);
    checkInTime.setHours(hours);
    checkInTime.setMinutes(minutes);
    
    // 允许提前30分钟签到
    checkInTime.setMinutes(checkInTime.getMinutes() - 30);
    
    return now >= checkInTime;
  },

  joinActivity() {
    if (this.data.activity.isFull || this.data.activity.status === 'completed') return;

    wx.showModal({
      title: '确认报名',
      content: `报名后每人需支付 ¥${this.data.activity.price}，是否确认报名？`,
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

            // 更新按钮状态和活动数据
            this.setData({
              hasJoined: true,
              canCheckIn: this.isToday(this.data.activity.date) && this.canCheckInNow(this.data.activity.date, this.data.activity.startTime),
              'activity.currentMembers': this.data.activity.currentMembers + 1,
              'activity.participants': newParticipants
            });
            this.calculateAAPrice();  // 重新计算AA费用

            // 保存到本地存储
            const myActivities = wx.getStorageSync('myActivities') || [];
            myActivities.push(this.data.activity);
            wx.setStorageSync('myActivities', myActivities);

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

  toggleCheckIn() {
    if (!this.data.canCheckIn) return;

    const action = this.data.hasCheckedIn ? '取消签到' : '签到';
    wx.showLoading({ title: `${action}中` });
    
    setTimeout(() => {
      wx.hideLoading();

      // 更新参与者的签到状态
      const participants = this.data.activity.participants.map(p => {
        if (p.name === '我') {
          // 创建新的参与者对象，不使用展开运算符
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            hasCheckedIn: !this.data.hasCheckedIn
          };
        }
        return p;
      });

      this.setData({
        hasCheckedIn: !this.data.hasCheckedIn,
        'activity.participants': participants
      });

      // 更新本地存储
      const myActivities = wx.getStorageSync('myActivities') || [];
      const updatedActivities = myActivities.map(a => {
        if (a.id === this.data.activity.id) {
          // 创建新的活动对象，不使用展开运算符
          return Object.assign({}, a, { participants: participants });
        }
        return a;
      });
      wx.setStorageSync('myActivities', updatedActivities);

      wx.showToast({
        title: `${action}成功`,
        icon: 'success'
      });
    }, 1000);
  },

  handleImageError(e) {
    const type = e.currentTarget.dataset.type || 'cover';
    const defaultImage = type === 'cover' 
      ? '../../assets/images/covers/default.png'
      : '../../assets/images/avatars/default.png';

    if (type === 'cover') {
      this.setData({ 'activity.coverImage': defaultImage });
    } else {
      const index = e.currentTarget.dataset.index;
      this.setData({ [`activity.participants[${index}].avatar`]: defaultImage });
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onPullDownRefresh() {
    this.getActivityDetail(this.data.activity.id);
    setTimeout(() => wx.stopPullDownRefresh(), 1000);
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({ urls: [url], current: url });
  },

  viewUserProfile(e) {
    const { userid } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/user-detail/index?id=${userid}` });
  },

  onShareAppMessage() {
    const { title, coverImage, id } = this.data.activity;
    return {
      title,
      imageUrl: coverImage,
      path: `/pages/activity-detail/index?id=${id}`
    };
  },

  cancelJoin() {
    // 检查活动是否已结束
    if (this.data.activity.status === 'completed') {
      wx.showToast({
        title: '已结束活动不能取消',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认取消',
      content: '确定要取消报名吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中' });
          
          setTimeout(() => {
            wx.hideLoading();
            
            // 更新按钮状态和活动数据
            this.setData({
              hasJoined: false,
              canCheckIn: false,
              'activity.currentMembers': this.data.activity.currentMembers - 1,
              'activity.participants': this.data.activity.participants.filter(p => p.name !== '我')
            });

            // 从本地存储中移除
            const myActivities = wx.getStorageSync('myActivities') || [];
            const updatedActivities = myActivities.filter(a => a.id !== this.data.activity.id);
            wx.setStorageSync('myActivities', updatedActivities);

            this.calculateAAPrice();  // 重新计算AA费用

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
  calculateAAPrice() {
    const { totalPrice, currentMembers } = this.data.activity;
    const aaPrice = Math.ceil(totalPrice / (currentMembers + 1));  // +1 计算报名后的费用
    this.setData({
      'activity.price': aaPrice
    });
  },

  // 添加检查活动状态的方法
  checkActivityStatus() {
    const now = new Date();
    const activityDate = new Date(this.data.activity.date);
    
    // 设置活动的开始和结束时间
    const [startHours, startMinutes] = this.data.activity.startTime.split(':').map(Number);
    const [endHours, endMinutes] = this.data.activity.endTime.split(':').map(Number);
    
    const startTime = new Date(activityDate);
    startTime.setHours(startHours, startMinutes, 0);
    
    const endTime = new Date(activityDate);
    endTime.setHours(endHours, endMinutes, 0);

    // 调试输出
    console.log('当前时间:', now.toLocaleString());
    console.log('活动日期:', activityDate.toLocaleString());
    console.log('开始时间:', startTime.toLocaleString());
    console.log('结束时间:', endTime.toLocaleString());

    let status = 'upcoming';
    
    // 如果活动日期在今天之前，标记为已结束
    if (activityDate.toDateString() < now.toDateString()) {
      status = 'completed';
    }
    // 如果是今天的活动
    else if (activityDate.toDateString() === now.toDateString()) {
      if (now > endTime) {
        status = 'completed';
      } else if (now >= startTime) {
        status = 'ongoing';
      }
    }

    console.log('活动状态:', status);

    this.setData({
      'activity.status': status
    });
  }
}); 