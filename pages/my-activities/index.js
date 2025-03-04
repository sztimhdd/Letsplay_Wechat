// pages/my-activities/index.js

const loginService = require('../../utils/login-service');
const { sheetsAPI } = require('../../utils/sheets-api');
const { userService } = require('../../services/user-service');
const app = getApp();

Page({

    /**
     * 页面的初始数据
     */
    data: {
        activities: [],
        tabs: [
            { key: 'all', name: '全部' },
            { key: 'upcoming', name: '待开始' },
            { key: 'ongoing', name: '进行中' },
            { key: 'completed', name: '已结束' }
        ],
        activeTab: 'all',
        balance: '0.00',
        ytdSpent: '0.00',
        transactions: [],
        userInfo: null,
        hasUserInfo: false,
        canIUseGetUserProfile: false,
        wechatId: '',
        userName: '',
        isLoading: true
    },

    /**
     * 生命周期函数--监听页面加载
     */
    async onLoad(options) {
        // 检查是否支持 getUserProfile
        if (wx.getUserProfile) {
            this.setData({
                canIUseGetUserProfile: true
            });
        }

        try {
            // 检查登录状态
            if (!loginService.checkLoginStatus()) {
                wx.redirectTo({ url: '/pages/login/index' });
                return;
            }

            // 获取用户信息
            const userInfo = loginService.getUserInfo();
            if (!userInfo) {
                throw new Error('未找到用户信息');
            }

            // 更新页面数据
            this.setData({
                userInfo,
                wechatId: userInfo.wechatId,
                userName: userInfo.name || '微信用户'
            });

            // 加载用户数据
            await this.loadUserData();

        } catch (err) {
            console.error('页面加载失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        }
    },
    
    async loadUserData() {
        try {
            const userInfo = loginService.getUserInfo();
            if (!userInfo) {
                throw new Error('未找到用户信息');
            }

            // 获取用户余额
            const balance = await sheetsAPI.getUserBalance(userInfo.wechatId);
            
            // 获取用户年度消费
            const ytdSpent = await sheetsAPI.getUserYTDSpent(userInfo.wechatId);

            this.setData({
                balance: balance || '0.00',
                ytdSpent: ytdSpent || '0.00'
            });

            // 加载活动和交易记录
            await Promise.all([
                this.loadActivities(),
                this.loadTransactions()
            ]);

            this.setData({ isLoading: false });
        } catch (err) {
            console.error('加载用户数据失败:', err);
            this.setData({ isLoading: false });
        }
    },
    
    /**
     * 获取用户信息
     */
    getUserProfile() {
        console.log('开始获取用户信息...');
        wx.getUserProfile({
            desc: '用于完善用户资料',
            success: (res) => {
                console.log('获取用户信息成功, 原始数据:', res);
                const userInfo = res.userInfo;
                console.log('解析后的用户信息:', {
                    昵称: userInfo.nickName,
                    头像: userInfo.avatarUrl,
                    性别: userInfo.gender,
                    语言: userInfo.language,
                    城市: userInfo.city,
                    省份: userInfo.province,
                    国家: userInfo.country
                });

                // 保存用户信息
                wx.setStorageSync('userInfo', userInfo);
                console.log('用户信息已保存到本地存储');
                
                this.setData({
                    userInfo: userInfo,
                    hasUserInfo: true
                });
                console.log('用户信息已更新到页面数据');
                
                // 更新全局用户信息
                app.updateUserInfo(userInfo);
                console.log('用户信息已更新到全局数据');
                
                wx.showToast({
                    title: '授权成功',
                    icon: 'success'
                });
            },
            fail: (err) => {
                console.error('获取用户信息失败, 错误信息:', err);
                console.error('错误详情:', {
                    错误码: err.errCode,
                    错误信息: err.errMsg,
                    错误栈: err.stack
                });
                wx.showToast({
                    title: '获取用户信息失败',
                    icon: 'none'
                });
            }
        });
    },
    
    /**
     * 退出登录
     */
    logout() {
        wx.showModal({
            title: '确认退出',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    loginService.clearLoginState();
                    app.globalData.hasLogin = false;
                    app.globalData.userInfo = null;
                    
                    // 跳转到登录页
                    wx.navigateTo({
                        url: '/pages/login/index'
                    });
                }
            }
        });
    },

    async loadTransactions() {
        try {
            const transactions = await sheetsAPI.getUserTransactions(this.data.wechatId);
            this.setData({ transactions });
        } catch (err) {
            console.error('加载交易记录失败:', err);
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function() {
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function() {
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function() {
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function() {
        this.loadUserData();
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function() {
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function() {
        return {
            title: '我参与的活动',
            path: '/pages/my-activities/index'
        };
    },

    switchTab: function(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ 
            activeTab: tab,
            isLoading: true
        }, async () => {
            await this.loadActivities();
            this.setData({ isLoading: false });
        });
    },

    async loadActivities() {
        try {
            const activities = await sheetsAPI.getActivities({
                wechatId: this.data.wechatId,
                status: this.data.activeTab
            });

            this.setData({ activities });
        } catch (err) {
            console.error('加载活动列表失败:', err);
        }
    },

    filterActivities: function(activities, tab) {
        tab = tab || this.data.activeTab;
        
        if (tab === 'all') {
            return activities;
        }

        // 获取当前时间
        var now = new Date();
        
        return activities.filter(function(activity) {
            // 解析活动时间
            var activityDate = new Date(activity.date.replace(/-/g, '/'));
            var startTime = new Date(activityDate);
            var endTime = new Date(activityDate);
            
            var startTimeArr = activity.startTime.split(':');
            var endTimeArr = activity.endTime.split(':');
            
            startTime.setHours(parseInt(startTimeArr[0], 10), parseInt(startTimeArr[1], 10), 0);
            endTime.setHours(parseInt(endTimeArr[0], 10), parseInt(endTimeArr[1], 10), 0);

            switch (tab) {
                case 'upcoming':
                    // 未开始的活动
                    return now < startTime;
                case 'ongoing':
                    // 正在进行的活动
                    return now >= startTime && now <= endTime;
                case 'completed':
                    // 已结束的活动
                    return now > endTime || activityDate < new Date(now.toDateString());
                default:
                    return true;
            }
        });
    },

    goToDetail: function(e) {
        var id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/activity-detail/index?id=' + id
        });
    },

    goToBalance: function() {
        // 检查是否是管理员
        const adminAuth = wx.getStorageSync('adminAuth');
        if (!adminAuth || adminAuth < Date.now()) {
            wx.showModal({
                title: '管理员验证',
                content: '',
                editable: true,
                success: (res) => {
                    if (res.confirm && res.content === '1') {
                        wx.setStorageSync('adminAuth', Date.now() + 3600000);
                        wx.navigateTo({
                            url: '/pages/balance-manage/index'
                        });
                    } else {
                        wx.showToast({
                            title: '无权限',
                            icon: 'none'
                        });
                    }
                }
            });
            return;
        }
        wx.navigateTo({
            url: '/pages/balance-manage/index'
        });
    },

    // 根据列标识获取活动时段
    getTimeSlotByColumn(column) {
        // 这里可以根据实际的时段规则进行配置
        const timeSlots = {
            'F': '08am~10am',
            'G': '20pm~22pm',
            'H': '10am~12pm',
            'I': '14pm~16pm',
            'J': '16pm~18pm',
            // ... 可以添加更多时段
        };
        return timeSlots[column] || '';  // 如果没有对应时段则返回空字符串
    }
})