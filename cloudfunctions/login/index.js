// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用动态环境配置
})

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('云函数开始执行');
  
  try {
    // 获取 OpenID
    const wxContext = cloud.getWXContext();
    console.log('获取到的微信上下文:', wxContext);
    
    if (!wxContext.OPENID) {
      console.error('未能获取到 OPENID');
    }

    return {
      event,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      env: cloud.DYNAMIC_CURRENT_ENV,
      success: true
    }
  } catch (err) {
    console.error('云函数执行错误:', err);
    return {
      success: false,
      error: err.message
    }
  }
} 