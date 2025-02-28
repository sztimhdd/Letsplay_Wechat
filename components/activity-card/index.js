const app = getApp();
const loginService = require('../../utils/login-service');
const signUpService = require('../../services/signup-service');
const sheetsAPI = require('../../utils/sheets-api');

Component({
  properties: {
    activity: {
      type: Object,
      value: null,
      observer: function(newVal) {
        if (newVal) {
          this.updateData(newVal);
        }
      }
    }
  },

  data: {
    displayDate: '',
    timeSlot: '',
    venue: '',
    participantCount: 0,
    maxParticipants: 16,
    isFull: false,
    perPersonFee: '0.00',
    hasJoined: false
  },

  observers: {
    'activity': function(activity) {
      if (!activity) return;
      
      const count = activity.participants?.length || 0;
      const max = activity.maxParticipants || 16;
      
      // 检查是否显示NEW徽章
      const isNew = this.checkIfNew(activity);
      
      this.setData({
        participantCount: count,
        maxParticipants: max,
        isFull: count >= max,
        isNew
      });
    }
  },

  methods: {
    updateData(activity) {
      if (!activity) return;

      const currentUser = loginService.getUserInfo();
      const hasJoined = currentUser && 
        activity.participants?.some(p => p.wechatId === currentUser.wechatId);

      this.setData({
        displayDate: activity.displayDate,
        timeSlot: activity.timeSlot,
        venue: activity.venue,
        participantCount: activity.participants?.length || 0,
        maxParticipants: activity.maxParticipants || 16,
        isFull: (activity.participants?.length || 0) >= (activity.maxParticipants || 16),
        perPersonFee: activity.perPersonFee || '0.00',
        hasJoined
      });
    },

    onTap() {
      const { activity } = this.properties;
      if (activity?.id) {
        this.triggerEvent('tap', { id: activity.id });
      }
    },

    getParticipantStatus(count, max) {
      if (count >= max) return 'warning';
      if (count >= max - 2) return 'near-limit';
      return '';
    },

    async onSignUp(e) {
      try {
        e.stopPropagation();
        
        // 检查登录状态
        if (!loginService.checkLoginStatus()) {
          throw new Error('请先登录');
        }

        const activityColumn = this.data.activity.column;
        if (!activityColumn) {
          throw new Error('活动信息不完整');
        }

        wx.showLoading({ title: '报名中' });
        const result = await signUpService.signUp(activityColumn);

        if (result.success) {
          wx.showToast({
            title: '报名成功',
            icon: 'success',
            duration: 2000
          });

          // 刷新数据
          setTimeout(async () => {
            await app.refreshActivities();
            const pages = getCurrentPages();
            const currentPage = pages[pages.length - 1];
            if (currentPage && currentPage.refreshData) {
              await currentPage.refreshData();
            }
          }, 2000);
        }

      } catch (err) {
        console.error('报名失败:', err);
        wx.showToast({
          title: err.message || '报名失败',
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
      }
    },

    // 检查是否显示NEW徽章
    async checkIfNew(activity) {
      if (!activity) return false;

      try {
        // 1. 检查活动日期是否在当前日期之后
        const now = new Date();
        const activityDate = new Date(activity.date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2'));
        const [startHour, startMinute] = activity.timeSlot.split('-')[0].split(':');
        activityDate.setHours(parseInt(startHour), parseInt(startMinute));
        
        if (activityDate <= now) return false;

        // 2. 检查活动是否可以报名
        if (activity.status !== 'upcoming' || 
            activity.participants.length >= activity.maxParticipants) {
          return false;
        }

        // 3. 检查当前用户是否已报名
        const currentUser = await app.getCurrentUser();
        if (!currentUser) return false;

        const hasJoined = activity.participants?.some(p => 
          p.wechat === currentUser.wechat
        );

        return !hasJoined;

      } catch (err) {
        console.error('检查NEW标签失败:', err);
        return false;
      }
    }
  }
}); 