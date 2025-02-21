// 创建一个模拟的浏览器环境
const mockBrowserEnv = {
    window: {
        navigator: {
            appName: 'Netscape',
            userAgent: 'Mozilla/5.0'
        },
        crypto: {
            getRandomValues: function(arr) {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            }
        },
        document: {
            title: 'Mock Document'
        }
    },
    navigator: {
        appName: 'Netscape',
        userAgent: 'Mozilla/5.0'
    },
    crypto: {
        getRandomValues: function(arr) {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }
    },
    document: {
        title: 'Mock Document'
    }
};

// 初始化全局环境
function initGlobalEnv() {
    console.log('正在初始化全局环境...');
    
    try {
        // 设置全局对象
        if (typeof global !== 'undefined') {
            Object.assign(global, mockBrowserEnv);
        }
        
        // 设置当前作用域
        Object.assign(this, mockBrowserEnv);
        
        // 设置 wx 对象
        if (typeof wx !== 'undefined') {
            Object.assign(wx, mockBrowserEnv);
        }

        // 验证环境
        console.log('环境初始化完成,验证:', {
            hasWindow: typeof window !== 'undefined',
            hasNavigator: typeof navigator !== 'undefined',
            hasCrypto: typeof crypto !== 'undefined',
            navigatorAppName: navigator?.appName,
            cryptoAvailable: typeof crypto?.getRandomValues === 'function'
        });

        return true;
    } catch (err) {
        console.error('初始化全局环境时出错:', err);
        throw err;
    }
}

// 初始化 jsrsasign
let jsrsasignInstance = null;

function getJsrsasign() {
    if (!jsrsasignInstance) {
        console.log('正在加载 jsrsasign...');
        
        try {
            // 确保环境已初始化
            initGlobalEnv();
            
            // 加载 jsrsasign
            jsrsasignInstance = require('./libs/jsrsasign-all-min.js');
            
            console.log('jsrsasign 加载成功');
        } catch (err) {
            console.error('jsrsasign 加载失败:', err);
            throw err;
        }
    }
    return jsrsasignInstance;
}

// 导出模块
module.exports = {
    initGlobalEnv,
    getJsrsasign
}; 