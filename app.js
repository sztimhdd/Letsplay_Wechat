// app.js
const sheetsAPI = require('./utils/sheets-api');
const loginService = require('./utils/login-service');
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
            // 初始化云开发
            wx.cloud.init({
                env: 'prod', // 替换为你的云开发环境ID
                traceUser: true,
            });
            if (!wx.cloud) {
                console.error('请使用 2.2.3 或以上的基础库以使用云能力')
            } else {
                wx.cloud.init({
                    env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用默认环境配置
                    traceUser: true,
                })
            }

            // 初始化 sheetsAPI
            await sheetsAPI.initialize();
            this.globalData.sheetsAPI = sheetsAPI;
            console.log('sheetsAPI 初始化成功');

            // 加载活动数据
            console.log('开始加载所有活动数据...');
            const activities = await sheetsAPI.getActivities(200);
            this.globalData.activities = activities;
            this.globalData.activitiesLoaded = true;
            console.log('活动数据加载完成:', activities.length);

            // 检查登录状态
            this.checkLoginStatus();
        } catch (err) {
            console.error('应用初始化失败:', err);
        }
    },

    // 检查登录状态
    checkLoginStatus() {
        const isLoggedIn = loginService.checkLoginStatus();
        this.globalData.hasLogin = isLoggedIn;
        
        if (isLoggedIn) {
            const userInfo = loginService.getUserInfo();
            if (userInfo) {
                this.globalData.userInfo = userInfo;
                console.log('已获取到用户信息:', userInfo);
            }
            
            // 获取当前用户数据
            this.getCurrentUser();
        } else {
            console.log('用户未登录，需要引导用户登录');
        }
        
        return isLoggedIn;
    },

    // 执行登录流程
    async doLogin() {
        try {
            const loginResult = await loginService.login();
            if (loginResult.success) {
                this.globalData.hasLogin = true;
                
                // 获取用户信息
                try {
                    const userInfo = await loginService.getUserProfile();
                    this.globalData.userInfo = userInfo;
                    console.log('获取用户信息成功:', userInfo);
                } catch (err) {
                    console.log('用户未授权获取信息:', err);
                }
                
                return true;
            } else {
                console.error('登录失败:', loginResult.error);
                return false;
            }
        } catch (err) {
            console.error('登录过程发生错误:', err);
            return false;
        }
    },
    
    // 更新用户信息
    updateUserInfo(userInfo) {
        if (userInfo) {
            this.globalData.userInfo = userInfo;
            console.log('更新用户信息成功:', userInfo);
        }
    },

    // 旧的登录方法，保留兼容性
    login: function() {
        return this.doLogin();
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
        try {
            const userInfo = loginService.getUserInfo();
            if (!userInfo) {
                throw new Error('未找到用户信息');
            }

            this.globalData.currentUser = userInfo;
            return userInfo;

        } catch (err) {
            console.error('获取当前用户失败:', err);
            return null;
        }
    },

    // 获取 sheetsAPI 实例
    async getSheetsAPI() {
        try {
            if (!this.globalData.sheetsAPI) {
                await sheetsAPI.initialize();
                this.globalData.sheetsAPI = sheetsAPI;
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
