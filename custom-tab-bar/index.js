Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#1AAD19",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        iconClass: "icon-home"
      },
      {
        pagePath: "/pages/my-activities/index",
        text: "我的",
        iconClass: "icon-user"
      }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
      this.setData({
        selected: data.index
      });
    }
  }
}); 