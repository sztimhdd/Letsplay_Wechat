const app = getApp();
import { signUpService } from '../../services/signup-service';

Component({
  properties: {
    activity: {
      type: Object,
      value: {
        displayDate: '',
        timeSlot: '',
        status: 'completed',
        venue: '',
        participants: [],
        maxParticipants: 16,
        perPersonFee: '0.00',
        bgImage: '/assets/images/covers/default.webp',
        column: '',
        isFull: false
      }
    }
  },

  data: {
    participantCount: 0,
    participantStatus: ''
  },

  observers: {
    'activity': function(activity) {
      if (!activity) return;
      
      const count = activity.participants?.length || 0;
      const max = activity.maxParticipants || 16;
      
      this.setData({
        participantCount: count,
        participantStatus: this.getParticipantStatus(count, max)
      });
    }
  },

  methods: {
    onTap() {
      const { activity } = this.data;
      this.triggerEvent('tap', { id: activity.id });
    },

    getParticipantStatus(count, max) {
      if (count >= max) return 'warning';
      if (count >= max - 2) return 'near-limit';
      return '';
    },

    async onSignUp(e) {
      console.log('报名按钮被点击');
      try {
        e.stopPropagation();

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
          icon: 'none',
          duration: 2000
        });
      } finally {
        wx.hideLoading();
      }
    }
  }
}); 