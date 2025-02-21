const app = getApp();
import { signUpService } from '../../services/signup-service';

Page({
  data: {
    activity: null,
    participants: [],
    checkedInCount: 0,
    totalParticipants: 0,
    perPersonFee: '0.00',
    loading: true
  },

  async onLoad(options) {
    try {
      const { id, column } = options;
      wx.showLoading({ title: '加载数据...' });

      // 获取活动数据
      const activity = app.getActivityById(id);
      if (!activity) {
        throw new Error('活动不存在');
      }

      // 确保活动有 column 属性
      const processedActivity = {
        ...activity,
        column: column || activity.column || `F${activity.field || activity.id.match(/\d+/)?.[0] || ''}`
      };

      console.log('签到页面活动数据:', {
        options,
        activity: processedActivity,
        hasColumn: !!processedActivity.column,
        originalActivity: activity
      });

      this.setData({
        activity: processedActivity,
        loading: false
      });

      // 加载参与者数据
      await this.loadParticipants();

    } catch (err) {
      console.error('加载签到页面失败:', err);
      wx.showToast({
        title: err.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 加载参与者信息
  async loadParticipants() {
    try {
      const { activity } = this.data;
      if (!activity?.column) {
        console.error('活动缺少列标识:', activity);
        return;
      }

      // 获取最新的参与者数据
      const participants = await signUpService.getActivityParticipants(activity.column);
      
      // 处理参与者数据用于显示
      const processedParticipants = participants.map(p => ({
        name: p.name,
        wechat: p.wechat,
        fee: activity.perPersonFee,
        avatar: '/assets/images/avatars/default.png',
        signUpNumber: p.signUpNumber,
        rowIndex: p.rowIndex,
        checkedIn: true // 默认已签到
      }));

      console.log('签到页面参与者列表:', {
        raw: participants,
        processed: processedParticipants,
        activityColumn: activity.column,
        hasRowIndexes: processedParticipants.every(p => !!p.rowIndex)
      });

      // 验证数据完整性
      if (!processedParticipants.every(p => !!p.rowIndex)) {
        throw new Error('参与者数据不完整');
      }

      // 更新页面数据
      this.setData({
        participants: processedParticipants,
        checkedInCount: processedParticipants.length,
        totalParticipants: processedParticipants.length,
        perPersonFee: (activity.totalFee / Math.max(processedParticipants.length, 1)).toFixed(2)
      });

    } catch (err) {
      console.error('加载参与者信息失败:', err);
      wx.showToast({
        title: '加载参与者失败',
        icon: 'none'
      });
    }
  },

  // 切换签到状态
  toggleCheckIn(e) {
    const { index } = e.currentTarget.dataset;
    const participants = [...this.data.participants];
    participants[index].checkedIn = !participants[index].checkedIn;

    // 更新签到统计
    const checkedInCount = participants.filter(p => p.checkedIn).length;

    this.setData({
      participants,
      checkedInCount,
      perPersonFee: (this.data.activity.totalFee / Math.max(checkedInCount, 1)).toFixed(2)
    });
  },

  // 保存签到结果
  async saveCheckIn() {
    try {
      wx.showLoading({ title: '保存中...' });
      
      const { activity, participants } = this.data;
      if (!activity?.column) {
        throw new Error('活动信息不完整');
      }

      console.log('准备保存签到数据:', {
        activityColumn: activity.column,
        totalParticipants: participants.length,
        checkedInCount: participants.filter(p => p.checkedIn).length,
        totalFee: activity.totalFee,
        participants: participants.map(p => ({
          name: p.name,
          checkedIn: p.checkedIn,
          rowIndex: p.rowIndex
        }))
      });

      // 获取 sheetsAPI 实例
      const sheetsAPI = await app.getSheetsAPI();
      console.log('获取到 sheetsAPI:', !!sheetsAPI);
      
      // 保存签到结果
      const result = await sheetsAPI.saveCheckInResults(activity.column, participants);
      console.log('保存签到结果:', result);

      // 更新页面显示
      this.setData({
        checkedInCount: result.checkedInCount,
        perPersonFee: result.perPersonFee
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 刷新活动数据
      console.log('开始刷新活动数据...');
      await app.refreshActivities();
      console.log('活动数据刷新完成');

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      console.error('保存签到结果失败:', err);
      wx.showToast({
        title: err.message || '保存失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 在页面显示时检查数据
  async onShow() {
    if (!this.data.activity && !this.data.loading) {
      // 如果没有活动数据且不在加载中，尝试刷新数据
      await app.refreshActivities();
      const { id } = this.options;
      if (id) {
        const activity = app.getActivityById(id);
        if (activity) {
          this.setData({
            activity: {
              ...activity,
              column: activity.column || `F${activity.field || activity.id.match(/\d+/)?.[0] || ''}`
            }
          });
          await this.loadParticipants();
        }
      }
    }
  }
}); 