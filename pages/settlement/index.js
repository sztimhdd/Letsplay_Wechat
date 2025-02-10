Page({
  data: {
    activity: null,
    members: []
  },

  onLoad(options) {
    const { id } = options;
    this.getSettlementDetail(id);
  },

  getSettlementDetail(id) {
    // 模拟获取结算详情数据
    const mockActivity = {
      id: id,
      title: '周末篮球友谊赛',
      date: '2024-03-23',
      startTime: '14:00',
      endTime: '16:00',
      totalFee: 400,
      averageFee: 50
    };

    const mockMembers = [
      {
        id: 1,
        nickname: '张三',
        avatar: '/assets/images/avatar1.png',
        balance: 150
      },
      {
        id: 2,
        nickname: '李四',
        avatar: '/assets/images/avatar2.png',
        balance: 200
      },
      {
        id: 3,
        nickname: '王五',
        avatar: '/assets/images/avatar3.png',
        balance: 100
      }
    ];

    this.setData({
      activity: mockActivity,
      members: mockMembers
    });
  },

  confirmSettlement() {
    wx.showModal({
      title: '确认结算',
      content: '确定要进行费用结算吗？此操作不可撤销',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '结算中'
          });
          
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({
              title: '结算成功',
              icon: 'success'
            });
            
            setTimeout(() => {
              wx.navigateBack({
                delta: 2
              });
            }, 1500);
          }, 1000);
        }
      }
    });
  }
}); 