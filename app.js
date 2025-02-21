// app.js
import { sheetsAPI } from './utils/sheets-api';
import { testUserActivityDetails } from './utils/test-sheets';
import { TEST_USER } from './utils/test-data';

App({
    globalData: {
        userInfo: null,
        hasLogin: false,
        sheetsAPI: null,
        activities: [], // 存储所有活动数据
        activitiesLoaded: false, // 标记是否已加载
        currentUser: null  // 添加当前用户信息
    },

    async onLaunch() {
        try {
            // 初始化 sheetsAPI
            const sheetsAPI = await this.getSheetsAPI();
            console.log('sheetsAPI 初始化成功');

            // 加载所有活动数据
            console.log('开始加载所有活动数据...');
            const activities = await sheetsAPI.getActivities(200);
            this.globalData.activities = activities;
            this.globalData.activitiesLoaded = true;
            console.log('活动数据加载完成:', activities.length);

            // 检查登录状态
            wx.checkSession({
                success: () => {
                    const token = wx.getStorageSync('token');
                    if (token) {
                        this.globalData.hasLogin = true;
                    }
                }
            });
        } catch (err) {
            console.error('应用初始化失败:', err);
        }
    },

    login: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            wx.login({
                success: function(res) {
                    if (res.code) {
                        // TODO: 发送 code 到后台换取 token
                        self.globalData.hasLogin = true;
                        resolve(res);
                    } else {
                        reject(new Error('登录失败'));
                    }
                },
                fail: reject
            });
        });
    },

    // 获取活动详情的辅助方法
    getActivityById(id) {
        return this.globalData.activities.find(activity => activity.id === id);
    },

    async refreshActivities() {
        try {
            console.log('开始刷新活动数据...');
            const activities = await sheetsAPI.getActivities(200);
            this.globalData.activities = activities;
            this.globalData.activitiesLoaded = true;
            console.log('活动数据刷新完成:', activities.length);
            return true;
        } catch (err) {
            console.error('刷新活动数据失败:', err);
            return false;
        }
    },

    // 获取当前用户信息
    async getCurrentUser() {
        if (this.globalData.currentUser) {
            return this.globalData.currentUser;
        }

        try {
            // 直接使用测试用户数据
            this.globalData.currentUser = TEST_USER;
            console.log('使用测试用户数据:', TEST_USER);
            return TEST_USER;

        } catch (err) {
            console.error('获取用户信息失败:', err);
            return null;
        }
    },

    // 获取 sheetsAPI 实例
    async getSheetsAPI() {
        try {
            if (!this.globalData.sheetsAPI) {
                await sheetsAPI.initialize();
                this.globalData.sheetsAPI = sheetsAPI;
                console.log('sheetsAPI 初始化完成');
            }
            
            if (!this.globalData.sheetsAPI) {
                throw new Error('sheetsAPI 初始化失败');
            }

            return this.globalData.sheetsAPI;
        } catch (err) {
            console.error('获取 sheetsAPI 失败:', err);
            throw err;
        }
    }
});

// 全局计算工具函数
function calculateAA(total, count) {
  return count > 0 ? parseFloat((total / count).toFixed(2)) : 0
}
