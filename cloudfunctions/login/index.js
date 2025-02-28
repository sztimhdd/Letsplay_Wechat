// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('云函数开始执行, 参数:', event);
  
  try {
    // 获取 OpenID
    const wxContext = cloud.getWXContext();
    console.log('获取到的微信上下文:', wxContext);
    
    if (!wxContext.OPENID) {
      console.error('未能获取到 OPENID');
      return {
        success: false,
        error: '获取OpenID失败'
      };
    }

    // 返回标准格式的结果
    return {
      success: true,
      data: {
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID
      }
    };
  } catch (err) {
    console.error('云函数执行错误:', err);
    return {
      success: false,
      error: err.message
    };
  }
} 