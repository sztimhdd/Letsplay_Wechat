var request = {
  get: function(url, params) {
    params = params || {};
    return this.request('GET', url, params);
  },
  
  post: function(url, data) {
    data = data || {};
    return this.request('POST', url, data);
  },
  
  request: function(method, url, data) {
    var self = this;
    var token = wx.getStorageSync('token');
    
    return new Promise(function(resolve, reject) {
      wx.request({
        url: BASE_URL + url,
        method: method,
        data: data,
        header: {
          Authorization: token ? 'Bearer ' + token : ''
        },
        success: function(res) {
          if (res.data.code === 1002) {
            wx.redirectTo({ url: '/pages/login/index' });
            return;
          }
          
          if (res.data.code !== 0) {
            wx.showToast({
              title: res.data.message,
              icon: 'none'
            });
            reject(new Error(res.data.message));
            return;
          }
          
          resolve(res.data);
        },
        fail: function(err) {
          reject(err);
        }
      });
    });
  }
};

module.exports = request; 