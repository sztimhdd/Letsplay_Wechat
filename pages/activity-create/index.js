// pages/activity-create/index.js
const { sheetsAPI } = require('../../utils/sheets-api.js');
const app = getApp();

Page({

    /**
     * 页面的初始数据
     */
    data: {
        date: '',
        startTime: '',
        endTime: '',
        field: '',
        maxParticipants: 16,
        totalFee: ''
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log('创建活动页面加载');
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
        console.log('创建活动页面显示');
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

    // 日期选择器变化
    onDateChange(e) {
        this.setData({ date: e.detail.value });
    },

    // 开始时间选择器变化
    onStartTimeChange(e) {
        this.setData({ startTime: e.detail.value });
    },

    // 结束时间选择器变化
    onEndTimeChange(e) {
        this.setData({ endTime: e.detail.value });
    },

    // 场地输入
    onFieldInput(e) {
        this.setData({ field: e.detail.value });
    },

    // 人数上限输入
    onMaxParticipantsInput(e) {
        this.setData({ maxParticipants: parseInt(e.detail.value) || 16 });
    },

    // 总费用输入
    onTotalFeeInput(e) {
        this.setData({ totalFee: e.detail.value });
    },

    // 表单提交
    async onSubmit(e) {
        console.log('表单提交被触发');
        console.log('表单数据:', e.detail.value);

        try {
            if (!this.validateForm()) {
                return;
            }

            const { date, startTime, endTime, field, maxParticipants, totalFee } = this.data;

            console.log('提交活动数据:', {
                date,
                startTime,
                endTime,
                field,
                maxParticipants,
                totalFee
            });

            wx.showLoading({ title: '创建中' });
            
            const result = await sheetsAPI.createActivity({
                date,
                field,
                maxParticipants,
                startTime,
                endTime,
                totalFee: parseFloat(totalFee)
            });

            console.log('创建活动结果:', result);

            if (result === true) {
                // 刷新全局活动数据
                await app.refreshActivities();
                
                wx.showToast({ 
                    title: '创建成功',
                    duration: 1500
                });

                // 延迟返回，确保 Toast 显示完整
                setTimeout(() => {
                    // 返回上一页并刷新
                    const pages = getCurrentPages();
                    const prevPage = pages[pages.length - 2];
                    if (prevPage) {
                        prevPage.refreshData(); // 调用首页的刷新方法
                    }
                    wx.navigateBack();
                }, 1500);
            } else {
                throw new Error('创建失败：未知错误');
            }

        } catch (err) {
            console.error('创建活动失败:', err);
            wx.showToast({ 
                title: err.message || '创建失败',
                icon: 'none',
                duration: 2000
            });
        } finally {
            wx.hideLoading();
        }
    },

    // 表单验证
    validateForm() {
        const { date, startTime, endTime, field, maxParticipants, totalFee } = this.data;

        if (!date) {
            wx.showToast({ title: '请选择日期', icon: 'none' });
            return false;
        }

        if (!startTime || !endTime) {
            wx.showToast({ title: '请选择时间', icon: 'none' });
            return false;
        }

        if (!field) {
            wx.showToast({ title: '请输入场地编号', icon: 'none' });
            return false;
        }

        if (!maxParticipants || maxParticipants < 1) {
            wx.showToast({ title: '请输入有效人数', icon: 'none' });
            return false;
        }

        if (!totalFee || parseFloat(totalFee) <= 0) {
            wx.showToast({ title: '请输入有效费用', icon: 'none' });
            return false;
        }

        return true;
    }
})