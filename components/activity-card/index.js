Component({
  properties: {
    activity: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onTap() {
      const { id } = this.data.activity;
      wx.navigateTo({
        url: `/pages/activity-detail/index?id=${id}`
      });
    }
  }
}); 