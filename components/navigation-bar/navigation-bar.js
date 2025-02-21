Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    back: {
      type: Boolean,
      value: false
    },
    color: {
      type: String,
      value: '#000000'
    }
  },

  data: {
    statusBarHeight: 20
  },

  lifetimes: {
    attached() {
      const info = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: info.statusBarHeight
      });
    }
  },

  methods: {
    goBack() {
      if (this.properties.back) {
        wx.navigateBack();
      }
    }
  }
}); 