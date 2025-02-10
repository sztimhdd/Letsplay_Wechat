// index.js
const { activities } = require('../../mock/activities.js');

Page({
  data: {
    activities: []
  },

  onLoad() {
    // 对活动按日期排序，新的在前
    const sortedActivities = activities.slice().sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.startTime}`).getTime();
      const dateB = new Date(`${b.date} ${b.startTime}`).getTime();
      return dateB - dateA;  // 降序排列，新的日期在前
    });

    this.setData({ activities: sortedActivities });
  },

  onSearch(e) {
    const keyword = e.detail.value;
    // TODO: 实现搜索功能
    console.log('搜索关键词:', keyword);
  },

  createActivity() {
    wx.showToast({
      title: '创建活动功能开发中',
      icon: 'none'
    });
  }
});
