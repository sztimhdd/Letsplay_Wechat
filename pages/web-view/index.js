Page({
  data: {
    url: ''
  },
  onLoad(options) {
    if (options.url) {
      const url = decodeURIComponent(options.url);
      this.setData({ url });
      
      // 监听URL变化
      this.watchUrlChange(url);
    }
  },

  watchUrlChange(url) {
    const app = getApp();
    
    // 检查URL是否包含授权码
    if (url.includes('code=')) {
      const code = this.getCodeFromUrl(url);
      if (code) {
        console.log('获取到授权码:', code);
        
        // 使用授权码获取token
        app.globalData.sheetsAPI.exchangeCodeForToken(code)
          .then(() => {
            console.log('Token获取成功');
            // 返回首页
            wx.navigateBack();
            // 重新测试连接
            return app.globalData.sheetsAPI.testConnection();
          })
          .catch(err => {
            console.error('Token获取失败:', err);
            wx.showToast({
              title: '授权失败',
              icon: 'none'
            });
          });
      }
    }
  },

  getCodeFromUrl(url) {
    const codeMatch = url.match(/code=([^&]+)/);
    return codeMatch ? codeMatch[1] : null;
  },

  handleMessage(e) {
    console.log('收到webview消息:', e.detail);
    // 检查消息中是否包含授权码
    if (e.detail.data && e.detail.data.code) {
      const code = e.detail.data.code;
      const app = getApp();
      
      app.globalData.sheetsAPI.exchangeCodeForToken(code)
        .then(() => {
          console.log('Token获取成功');
          wx.navigateBack();
          return app.globalData.sheetsAPI.testConnection();
        })
        .catch(err => {
          console.error('Token获取失败:', err);
          wx.showToast({
            title: '授权失败',
            icon: 'none'
          });
        });
    }
  }
}); 