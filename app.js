// app.js
// 使用动态导入避免循环依赖
let sheetsAPI = null;
try {
    const sheetsModule = require('./utils/sheets-api');
    sheetsAPI = sheetsModule.sheetsAPI;
} catch (err) {
    console.error('导入sheetsAPI模块失败:', err);
}
const loginService = require('./utils/login-service');
import { testUserActivityDetails } from './utils/test-sheets';
import { TEST_USER } from './utils/test-data';
import { apiTest } from './utils/test-api';

App({
    globalData: {
        userInfo: null,
        hasLogin: false,
        sheetsAPI: null,
        activities: [], // 存储所有活动数据
        activitiesLoaded: false, // 标记是否已加载
        currentUser: null,  // 添加当前用户信息
        apiConnected: false // 标记API是否连接成功
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

            // 测试API连接
            console.log('开始测试API连接...');
            // 使用延迟测试函数，等待2秒后执行API测试
            const apiConnected = await apiTest.delayedTest(2000);
            this.globalData.apiConnected = apiConnected;
            
            if (!apiConnected) {
                console.error('API连接失败，应用可能无法正常工作');
                wx.showToast({
                    title: 'API连接失败，请稍后再试',
                    icon: 'none',
                    duration: 3000
                });
                return;
            }
            console.log('API连接测试成功，应用可以正常使用');

            // 初始化 sheetsAPI
            if (!sheetsAPI) {
                console.error('sheetsAPI 未定义，尝试重新导入');
                try {
                    const sheetsModule = require('./utils/sheets-api');
                    sheetsAPI = sheetsModule.sheetsAPI;
                    if (!sheetsAPI) {
                        throw new Error('sheetsAPI 导入后仍为空');
                    }
                } catch (importErr) {
                    console.error('重新导入 sheetsAPI 失败:', importErr);
                    wx.showToast({
                        title: '系统初始化失败，请重启应用',
                        icon: 'none',
                        duration: 3000
                    });
                    return;
                }
            }
            
            try {
                await sheetsAPI.initialize();
                this.globalData.sheetsAPI = sheetsAPI;
                console.log('sheetsAPI 初始化成功');
            } catch (initErr) {
                console.error('sheetsAPI 初始化失败:', initErr);
                wx.showToast({
                    title: 'Google Sheets 连接失败',
                    icon: 'none',
                    duration: 3000
                });
                return;
            }

            // 加载活动数据
            try {
                console.log('开始加载所有活动数据...');
                const activities = await sheetsAPI.getActivities(200);
                this.globalData.activities = activities;
                this.globalData.activitiesLoaded = true;
                console.log('活动数据加载完成:', activities.length);
            } catch (dataErr) {
                console.error('加载活动数据失败:', dataErr);
                // 继续执行，不阻止登录流程
            }

            // 检查登录状态
            const isLoggedIn = this.checkLoginStatus();
            
            // 如果未登录，延迟跳转到登录页面
            // 使用延迟是为了确保应用初始化完成
            if (!isLoggedIn) {
                console.log('用户未登录，准备跳转到登录页面');
                setTimeout(() => {
                    const currentPages = getCurrentPages();
                    const currentRoute = currentPages.length ? currentPages[currentPages.length - 1].route : '';
                    
                    // 如果当前不在登录页面，则跳转到登录页面
                    if (currentRoute !== 'pages/login/index') {
                        console.log('跳转到登录页面');
                        wx.redirectTo({
                            url: '/pages/login/index',
                            fail: (err) => {
                                console.error('跳转到登录页面失败:', err);
                                // 尝试使用navigateTo
                                wx.navigateTo({
                                    url: '/pages/login/index',
                                    fail: (err2) => {
                                        console.error('navigateTo到登录页面也失败:', err2);
                                        // 最后尝试reLaunch
                                        wx.reLaunch({
                                            url: '/pages/login/index',
                                            fail: (err3) => {
                                                console.error('所有跳转方式都失败:', err3);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }, 1000);
            }
        } catch (err) {
            console.error('应用初始化失败:', err);
            wx.showToast({
                title: '应用初始化失败: ' + (err.message || '未知错误'),
                icon: 'none',
                duration: 3000
            });
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
                
                // 检查用户是否需要匹配
                if (userInfo.needMatch) {
                    console.log('用户需要进行匹配，跳转到匹配页面');
                    wx.redirectTo({
                        url: '/pages/user-match/index'
                    });
                    return false;
                }
                
                // 获取当前用户数据
                this.getCurrentUser();
            } else {
                console.log('登录状态异常：已登录但无用户信息');
                // 清除异常的登录状态
                loginService.clearLoginStatus();
                this.globalData.hasLogin = false;
            }
        } else {
            console.log('用户未登录，需要引导用户登录');
            // 确保全局状态一致
            this.globalData.userInfo = null;
            this.globalData.currentUser = null;
        }
        
        return isLoggedIn;
    },

    // 执行登录流程
    async doLogin() {
        try {
            const loginResult = await loginService.login();
            if (loginResult.success) {
                this.globalData.hasLogin = true;
                this.globalData.userInfo = loginResult.userInfo;
                console.log('登录成功，用户信息:', loginResult.userInfo);
                return true;
            } else {
                console.error('登录失败:', loginResult.error);
                wx.showToast({
                    title: loginResult.error || '登录失败',
                    icon: 'none'
                });
                return false;
            }
        } catch (err) {
            console.error('登录过程发生错误:', err);
            wx.showToast({
                title: err.message || '登录失败',
                icon: 'none'
            });
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
            
            // 检查sheetsAPI是否可用
            if (!sheetsAPI) {
                console.error('sheetsAPI 未定义，无法刷新活动数据');
                return false;
            }
            
            // 确保sheetsAPI已初始化
            if (!sheetsAPI.initialized) {
                try {
                    await sheetsAPI.initialize();
                } catch (initErr) {
                    console.error('sheetsAPI 初始化失败:', initErr);
                    return false;
                }
            }
            
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
            // 检查登录状态
            if (!this.globalData.hasLogin) {
                console.log('用户未登录，无法获取用户信息');
                return null;
            }
            
            const userInfo = loginService.getUserInfo();
            if (!userInfo) {
                console.log('未找到用户信息，可能需要重新登录');
                return null;
            }

            // 更新全局用户信息
            this.globalData.currentUser = userInfo;
            console.log('成功获取当前用户信息:', userInfo);
            return userInfo;

        } catch (err) {
            console.error('获取当前用户失败:', err);
            // 不抛出错误，而是返回null
            return null;
        }
    },

    // 获取 sheetsAPI 实例
    async getSheetsAPI() {
        try {
            // 如果全局已有实例，直接返回
            if (this.globalData.sheetsAPI) {
                return this.globalData.sheetsAPI;
            }
            
            // 检查模块级变量
            if (!sheetsAPI) {
                console.error('sheetsAPI 未定义，尝试重新导入');
                try {
                    const sheetsModule = require('./utils/sheets-api');
                    sheetsAPI = sheetsModule.sheetsAPI;
                    if (!sheetsAPI) {
                        throw new Error('sheetsAPI 导入后仍为空');
                    }
                } catch (importErr) {
                    console.error('重新导入 sheetsAPI 失败:', importErr);
                    throw new Error('系统初始化失败: 无法加载 sheetsAPI 模块');
                }
            }
            
            // 确保已初始化
            if (!sheetsAPI.initialized) {
                try {
                    await sheetsAPI.initialize();
                    console.log('getSheetsAPI: 初始化完成');
                } catch (initErr) {
                    console.error('sheetsAPI 初始化失败:', initErr);
                    throw new Error('系统初始化失败: 无法初始化 sheetsAPI');
                }
            }
            
            // 更新全局实例并返回
            this.globalData.sheetsAPI = sheetsAPI;
            return sheetsAPI;
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
