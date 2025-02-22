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
      const info = wx.getWindowInfo();
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