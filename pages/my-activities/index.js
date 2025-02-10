// pages/my-activities/index.js
const { activities } = require('../../mock/activities.js');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        activities: [],
        tabs: [
            { key: 'all', name: '全部' },
            { key: 'upcoming', name: '待签到' },
            { key: 'ongoing', name: '进行中' },
            { key: 'completed', name: '已完成' }
        ],
        activeTab: 'all',
        balance: 100.00
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        // 获取我参与的活动
        const myActivities = activities.filter(a => 
            a.participants.some(p => p.name === '我')
        );
        this.setData({ activities: myActivities });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    switchTab(e) {
        const { tab } = e.currentTarget.dataset;
        this.setData({ activeTab: tab });
        // 在实际应用中，这里可以根据tab筛选数据
    },

    goToDetail(e) {
        const { id } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/activity-detail/index?id=${id}`
        });
    },

    goToBalance() {
        wx.navigateTo({
            url: '/pages/balance-manage/index'
        });
    }
})