const app = getApp();
import { signUpService } from '../../services/signup-service';

Page({
  data: {
    activity: null,
    participants: [],
    checkedInCount: 0,
    totalParticipants: 0,
    perPersonFee: '0.00',
    loading: true,
    statusBarHeight: 20
  },

  async onLoad(options) {
    try {
      const { id } = options;
      const windowInfo = wx.getWindowInfo();
      
      this.setData({
        statusBarHeight: windowInfo.statusBarHeight,
        loading: true
      });

      wx.showLoading({ title: '加载数据...' });

      // 获取活动数据
      const activity = app.getActivityById(id);
      if (!activity) {
        throw new Error('活动不存在');
      }

      // 确保活动已结束
      if (activity.status !== 'completed') {
        throw new Error('活动尚未结束，不能进行结算');
      }

      console.log('签到页面活动数据:', {
        activity,
        hasColumn: !!activity.column,
        participants: activity.participants
      });

      this.setData({
        activity,
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
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
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

      // 计算人均费用
      const perPersonFee = (activity.totalFee / Math.max(processedParticipants.length, 1)).toFixed(2);

      console.log('签到页面参与者列表:', {
        total: processedParticipants.length,
        perPersonFee,
        participants: processedParticipants
      });

      // 更新页面数据
      this.setData({
        participants: processedParticipants,
        checkedInCount: processedParticipants.length,
        totalParticipants: processedParticipants.length,
        perPersonFee
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

    // 更新签到统计和人均费用
    const checkedInCount = participants.filter(p => p.checkedIn).length;
    const perPersonFee = (this.data.activity.totalFee / Math.max(checkedInCount, 1)).toFixed(2);

    this.setData({
      participants,
      checkedInCount,
      perPersonFee
    });
  },

  // 保存签到结果
  async saveCheckIn() {
    try {
      const { activity, participants } = this.data;
      if (!activity?.column) {
        throw new Error('活动信息不完整');
      }

      // 获取已签到的参与者
      const checkedInParticipants = participants.filter(p => p.checkedIn);
      if (!checkedInParticipants.length) {
        throw new Error('至少需要一名参与者签到');
      }

      wx.showLoading({ title: '保存中...' });

      // 获取 sheetsAPI 实例
      const sheetsAPI = await app.getSheetsAPI();
      if (!sheetsAPI) {
        throw new Error('系统初始化失败');
      }

      console.log('准备保存签到数据:', {
        activityColumn: activity.column,
        totalParticipants: participants.length,
        checkedInCount: checkedInParticipants.length,
        totalFee: activity.totalFee,
        perPersonFee: this.data.perPersonFee,
        participants: participants.map(p => ({
          name: p.name,
          wechat: p.wechat,
          checkedIn: p.checkedIn,
          rowIndex: p.rowIndex
        }))
      });

      // 保存签到结果
      const result = await sheetsAPI.saveCheckInResults(
        activity.column,
        participants.map(p => ({
          rowIndex: p.rowIndex,
          checkedIn: p.checkedIn,
          fee: p.checkedIn ? this.data.perPersonFee : 0
        }))
      );

      if (result.success) {
        // 刷新全局活动数据
        await app.refreshActivities();

        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 2000
        });

        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        throw new Error('保存失败');
      }

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

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
}); 