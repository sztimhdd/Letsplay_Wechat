Page({
  data: {
    activity: null,
    members: [],
    checkedCount: 0
  },

  onLoad(options) {
    const { id } = options;
    this.getActivityDetail(id);
  },

  getActivityDetail(id) {
    // 模拟获取活动详情数据
    const mockActivity = {
      id: id,
      title: '周末篮球友谊赛',
      date: '2024-03-23',
      startTime: '14:00',
      endTime: '16:00',
      currentMembers: 8
    };

    const mockMembers = [
      {
        id: 1,
        nickname: '张三',
        avatar: '/assets/images/avatar1.png',
        status: 'checked'
      },
      {
        id: 2,
        nickname: '李四',
        avatar: '/assets/images/avatar2.png',
        status: 'unchecked'
      },
      {
        id: 3,
        nickname: '王五',
        avatar: '/assets/images/avatar3.png',
        status: 'unchecked'
      }
    ];

    const checkedCount = mockMembers.filter(member => member.status === 'checked').length;

    this.setData({
      activity: mockActivity,
      members: mockMembers,
      checkedCount
    });
  },

  handleCheckIn(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showLoading({
      title: '签到中'
    });

    setTimeout(() => {
      const members = this.data.members.map(member => {
        if (member.id === id) {
          return { ...member, status: 'checked' };
        }
        return member;
      });

      const checkedCount = members.filter(member => member.status === 'checked').length;

      this.setData({
        members,
        checkedCount
      });

      wx.hideLoading();
      wx.showToast({
        title: '签到成功',
        icon: 'success'
      });
    }, 1000);
  },

  goToSettlement() {
    wx.navigateTo({
      url: `/pages/settlement/index?id=${this.data.activity.id}`
    });
  }
}); 