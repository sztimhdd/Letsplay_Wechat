Page({
  data: {
    activity: {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      maxMembers: '',
      totalPrice: '',
      description: ''
    },
    adminUnlocked: false
  },

  onLoad() {
    // 检查管理员权限
    const authTime = wx.getStorageSync('adminAuth')
    if (!authTime || authTime < Date.now()) {
      this.verifyAdminPassword()
    } else {
      this.setData({ adminUnlocked: true })
    }
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
    this.setData({
      [`activity.${field}`]: e.detail.value
    })
  },

  // 创建活动
  createActivity() {
    const { activity } = this.data
    
    // 表单验证
    if (!this.validateForm()) {
      return
    }

    // 获取现有活动列表
    let activities = wx.getStorageSync('activities') || []
    
    // 生成新活动ID
    const newId = Math.max(...activities.map(a => a.id), 0) + 1
    
    // 创建新活动对象
    const newActivity = {
      ...activity,
      id: newId,
      status: 'upcoming',
      statusText: '即将开始',
      participants: [],
      currentMembers: 0,
      coverImage: '/assets/images/covers/default.webp',
      price: Number(activity.totalPrice)  // 初始时显示总价
    }
    
    // 添加到活动列表
    activities.push(newActivity)
    wx.setStorageSync('activities', activities)
    
    wx.showToast({
      title: '创建成功',
      success: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    })
  },

  // 表单验证
  validateForm() {
    const { activity } = this.data
    const requiredFields = ['title', 'date', 'startTime', 'endTime', 'location', 'maxMembers', 'totalPrice']
    
    for (const field of requiredFields) {
      if (!activity[field]) {
        wx.showToast({
          title: '请填写完整信息',
          icon: 'none'
        })
        return false
      }
    }
    
    if (Number(activity.maxMembers) < 2) {
      wx.showToast({
        title: '人数至少2人',
        icon: 'none'
      })
      return false
    }
    
    if (Number(activity.totalPrice) <= 0) {
      wx.showToast({
        title: '总费用必须大于0',
        icon: 'none'
      })
      return false
    }
    
    return true
  }
}) 