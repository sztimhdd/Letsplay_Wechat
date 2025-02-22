const app = getApp();

Page({
  data: {
    activity: {
      date: '',
      startTime: '20:00',
      endTime: '22:00',
      field: '',
      maxParticipants: 16,
      totalFee: 161
    },
    today: '',
    adminUnlocked: false,
    loading: false
  },

  onLoad() {
    // 设置今天的日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // 检查管理员权限
    const authTime = wx.getStorageSync('adminAuth')
    if (!authTime || authTime < Date.now()) {
      this.verifyAdminPassword()
    } else {
      this.setData({ adminUnlocked: true })
    }

    // 设置默认值
    this.setData({
      today: todayStr,
      'activity.date': todayStr
    });
  },

  // 验证管理员密码
  verifyAdminPassword() {
    wx.showModal({
      title: '管理员验证',
      content: '',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content === '1') {
          wx.setStorageSync('adminAuth', Date.now() + 3600000)
          this.setData({ adminUnlocked: true })
        } else if (res.confirm) {
          wx.showToast({
            title: '密码错误',
            icon: 'none'
          })
          wx.navigateBack()
        }
      }
    })
  },

  // 日期选择
  bindDateChange(e) {
    this.setData({
      'activity.date': e.detail.value
    })
  },

  // 时间选择
  bindTimeChange(e) {
    const { type } = e.currentTarget.dataset
    this.setData({
      [`activity.${type}`]: e.detail.value
    })
  },

  // 输入框变化
  handleInput(e) {
    const { field } = e.currentTarget.dataset
    let value = e.detail.value;
    
    // 对特定字段进行处理
    if (field === 'maxParticipants') {
      value = parseInt(value) || 16;
    } else if (field === 'totalFee') {
      value = parseFloat(value) || 161;
    }

    this.setData({
      [`activity.${field}`]: value
    })
  },

  // 创建活动
  async createActivity() {
    try {
      const { activity } = this.data;
      
      // 表单验证
      if (!this.validateForm()) {
        return;
      }

      this.setData({ loading: true });
      wx.showLoading({ title: '创建中...' });

      // 获取 sheetsAPI 实例
      const sheetsAPI = await app.getSheetsAPI();
      if (!sheetsAPI) {
        throw new Error('系统初始化失败');
      }

      // 格式化日期
      const dateObj = new Date(activity.date);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

      // 准备活动数据
      const newActivity = {
        date: formattedDate,
        field: `${activity.field}号场 - ${activity.maxParticipants}人`,
        startTime: activity.startTime,
        endTime: activity.endTime,
        totalFee: parseFloat(activity.totalFee),
        maxParticipants: parseInt(activity.maxParticipants)
      };

      console.log('准备创建活动:', newActivity);

      // 调用 API 创建活动
      const result = await sheetsAPI.createActivity(newActivity);

      if (result) {
        // 刷新全局活动数据
        await app.refreshActivities();

        wx.showToast({
          title: '创建成功',
          icon: 'success',
          duration: 2000
        });

        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      }

    } catch (err) {
      console.error('创建活动失败:', err);
      wx.showToast({
        title: err.message || '创建失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // 表单验证
  validateForm() {
    const { activity } = this.data;
    
    if (!activity.field) {
      wx.showToast({
        title: '请输入场地号',
        icon: 'none'
      });
      return false;
    }
    
    if (Number(activity.maxParticipants) < 2) {
      wx.showToast({
        title: '人数至少2人',
        icon: 'none'
      });
      return false;
    }
    
    if (Number(activity.totalFee) <= 0) {
      wx.showToast({
        title: '总费用必须大于0',
        icon: 'none'
      });
      return false;
    }

    // 检查日期是否有效
    const selectedDate = new Date(activity.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      wx.showToast({
        title: '不能选择过去的日期',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  }
}) 