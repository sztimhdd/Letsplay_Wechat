// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    
    if (!wxContext.OPENID) {
      return {
        success: false,
        error: '获取OpenID失败'
      };
    }

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