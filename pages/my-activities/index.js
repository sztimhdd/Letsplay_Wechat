// pages/my-activities/index.js

const app = getApp();
const loginService = require('../../utils/login-service');

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
        canIUseGetUserProfile: false
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

        // 检查登录状态
        this.checkLoginStatus();
        
        await this.loadUserData();
        await this.loadTransactions();
        await this.loadActivities();
    },
    
    /**
     * 检查登录状态
     */
    checkLoginStatus() {
        const isLoggedIn = loginService.checkLoginStatus();
        
        if (!isLoggedIn) {
            console.log('用户未登录，跳转到登录页面');
            wx.navigateTo({
                url: '/pages/login/index'
            });
            return false;
        }
        
        // 获取用户信息
        const userInfo = loginService.getUserInfo();
        if (userInfo) {
            this.setData({
                userInfo: userInfo,
                hasUserInfo: true
            });
            app.globalData.userInfo = userInfo;
            app.globalData.hasLogin = true;
        } else {
            console.log('已登录但无用户信息');
        }
        
        return true;
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

    async loadUserData() {
        try {
            const currentUser = await app.getCurrentUser();
            if (!currentUser) return;

            const sheetsAPI = await app.getSheetsAPI();
            const userRow = currentUser.row;

            // 获取余额和年度消费
            const [balanceData, spentData] = await Promise.all([
                sheetsAPI.readSheet(`Record!D${userRow}`),
                sheetsAPI.readSheet(`Record!E${userRow}`)
            ]);

            this.setData({
                balance: parseFloat(balanceData[0][0] || 0).toFixed(2),
                ytdSpent: parseFloat(spentData[0][0] || 0).toFixed(2)
            });

        } catch (err) {
            console.error('加载用户数据失败:', err);
            wx.showToast({
                title: '加载用户数据失败',
                icon: 'none'
            });
        }
    },

    async loadTransactions() {
        try {
            const currentUser = await app.getCurrentUser();
            if (!currentUser) return;

            const sheetsAPI = await app.getSheetsAPI();
            const userRow = currentUser.row;
            const userWechat = currentUser.wechat;

            // 分批读取日期行
            const ranges = [
                'Record!F2:Z2',   // F-Z
                'Record!AA2:AZ2', // AA-AZ
                'Record!BA2:BZ2', // BA-BZ
                'Record!CA2:CZ2'  // CA-CZ
            ];
            
            let allDates = [];
            for (const range of ranges) {
                const dateRow = await sheetsAPI.readSheet(range);
                if (!dateRow || !dateRow[0]) break;
                allDates = [...allDates, ...dateRow[0]];
            }
            
            if (allDates.length === 0) {
                throw new Error('无法读取日期行');
            }
            
            // 找到最后一个有日期的列的索引
            const lastDateIndex = allDates.reduce((lastIndex, date, index) => {
                return date ? index : lastIndex;
            }, 0);
            
            // 计算最后一列的字母
            let lastColumn;
            if (lastDateIndex < 20) { // F-Z
                lastColumn = String.fromCharCode(70 + lastDateIndex);
            } else if (lastDateIndex < 46) { // AA-AZ
                lastColumn = 'A' + String.fromCharCode(65 + (lastDateIndex - 20));
            } else if (lastDateIndex < 72) { // BA-BZ
                lastColumn = 'B' + String.fromCharCode(65 + (lastDateIndex - 46));
            } else if (lastDateIndex < 98) { // CA-CZ
                lastColumn = 'C' + String.fromCharCode(65 + (lastDateIndex - 72));
            }
            
            if (!lastColumn) {
                console.warn('列范围过大，将限制在CZ列');
                lastColumn = 'CZ';
            }
            
            console.log('读取范围:', {
                开始列: 'F',
                结束列: lastColumn,
                总列数: lastDateIndex + 1
            });

            // 并行获取扣费记录和充值记录
            const [expenseRecords, depositRecords, expenseDates] = await Promise.all([
                sheetsAPI.readSheet(`Record!F${userRow}:${lastColumn}${userRow}`),  // 扣费记录
                sheetsAPI.readSheet('Deposit Record!A2:D5000'),  // 充值记录
                sheetsAPI.readSheet(`Record!F2:${lastColumn}2`)  // 获取消费日期行
            ]);

            // 处理扣费记录
            const expenses = (expenseRecords[0] || [])
                .map((amount, index) => {
                    if (!amount) return null;
                    
                    // 判断是否为报名序号
                    const value = parseFloat(amount);
                    if (Number.isInteger(value) && value > 0 && value < 100) {
                        // 可能是报名序号，跳过
                        return null;
                    }
                    
                    // 从日期行获取对应列的日期
                    const dateStr = expenseDates[0][index];
                    if (!dateStr) return null;
                    
                    // 解析日期 "MM/DD/YYYY" 格式
                    const [month, day, year] = dateStr.split('/');
                    const dateObj = new Date(year, month - 1, day);
                    
                    // 获取活动时段（从列标识解析）
                    const timeSlot = this.getTimeSlotByColumn(String.fromCharCode(70 + index));
                    
                    // 根据是否有时段信息构建显示标题
                    const displayTitle = timeSlot ? 
                        `${month}月${day}日 - ${timeSlot} - 消费` : 
                        `${month}月${day}日 - 消费`;
                    
                    return {
                        amount: Math.abs(value).toFixed(2),
                        type: 'expense',
                        dateObj,
                        displayTitle,
                        date: dateObj.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        })
                    };
                })
                .filter(record => record !== null);

            // 处理充值记录
            const deposits = (depositRecords || [])
                .map(record => {
                    if (!record || record[1] !== userWechat) return null;
                    // 解析日期 "MM/DD/YYYY" 格式
                    const [month, day, year] = record[0].split('/');
                    // 存储原始日期对象用于排序
                    const dateObj = new Date(year, month - 1, day);
                    return {
                        amount: parseFloat(record[2]).toFixed(2),
                        type: 'deposit',
                        dateObj,
                        displayTitle: `充值 - ${record[3] === 'Cash' ? '现金充值' : '电子转账'}`,
                        date: dateObj.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        })
                    };
                })
                .filter(record => record !== null);

            // 合并并按日期排序
            const allTransactions = [...expenses, ...deposits]
                .sort((a, b) => b.dateObj - a.dateObj) // 直接使用日期对象排序
                .map(transaction => {
                    // 创建新对象，排除 dateObj
                    const newTransaction = {
                        amount: transaction.amount,
                        type: transaction.type,
                        date: transaction.date,
                        displayTitle: transaction.displayTitle
                    };
                    
                    return newTransaction;
                });

            // 验证余额
            const calculatedBalance = allTransactions.reduce((sum, trans) => {
                return sum + (trans.type === 'deposit' ? 
                    parseFloat(trans.amount) : 
                    -parseFloat(trans.amount));
            }, 0);

            const currentBalance = parseFloat(this.data.balance);
            
            console.log('余额验证:', {
                计算余额: calculatedBalance.toFixed(2),
                实际余额: currentBalance.toFixed(2),
                是否匹配: Math.abs(calculatedBalance - currentBalance) < 0.01
            });

            // 验证余额时添加日志
            console.log('交易记录:', {
                总记录: allTransactions.length,
                消费记录: expenses.length,
                充值记录: deposits.length,
                消费明细: expenses.map(e => ({
                    金额: e.amount,
                    日期: e.date,
                    列: e.displayTitle
                }))
            });

            this.setData({ transactions: allTransactions });

        } catch (err) {
            console.error('加载交易记录失败:', err);
            this.setData({ transactions: [] });
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
        this.loadActivities();
        wx.stopPullDownRefresh();
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
        var tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab }, function() {
            // 切换标签时重新加载并筛选活动
            this.loadActivities();
        }.bind(this));
    },

    // 添加统一的活动加载方法
    loadActivities: function() {
        // 从本地存储获取已报名的活动
        var myActivities = wx.getStorageSync('myActivities') || [];
        
        // 为每个活动添加 hasJoined 标记
        myActivities = myActivities.map(function(activity) {
            // 检查当前用户是否在参与者列表中
            var hasJoined = activity.participants.some(function(p) {
                return p.name === '我';
            });
            
            return Object.assign({}, activity, { hasJoined: hasJoined });
        });

        // 根据当前标签筛选活动
        var filteredActivities = this.filterActivities(myActivities);

        this.setData({ 
            activities: filteredActivities 
        });
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