// pages/balance-manage/index.js
const app = getApp();

Page({

    /**
     * 页面的初始数据
     */
    data: {
        users: [],
        loading: true
    },

    /**
     * 生命周期函数--监听页面加载
     */
    async onLoad(options) {
        await this.loadUsers();
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    async onPullDownRefresh() {
        await this.loadUsers();
        wx.stopPullDownRefresh();
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    async loadUsers() {
        try {
            wx.showLoading({ title: '加载中' });
            const sheetsAPI = await app.getSheetsAPI();

            // 获取所有用户数据
            const [names, wechats, balances, ytdSpent] = await Promise.all([
                sheetsAPI.readSheet('Record!B9:B200'),  // 姓名
                sheetsAPI.readSheet('Record!C9:C200'),  // 微信号
                sheetsAPI.readSheet('Record!D9:D200'),  // 余额
                sheetsAPI.readSheet('Record!E9:E200')   // 年度消费
            ]);

            // 处理用户数据
            const users = names.map((name, index) => ({
                name: name[0],
                wechat: wechats[index][0],
                balance: parseFloat(balances[index][0] || 0).toFixed(2),
                ytdSpent: parseFloat(ytdSpent[index][0] || 0).toFixed(2)
            })).filter(user => !!user.name);

            this.setData({ users, loading: false });

        } catch (err) {
            console.error('加载用户数据失败:', err);
            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        } finally {
            wx.hideLoading();
        }
    },

    // 调整余额
    async adjustBalance(e) {
        const { index } = e.currentTarget.dataset;
        const user = this.data.users[index];

        wx.showModal({
            title: '调整余额',
            content: '请输入调整金额（正数为充值，负数为扣除）',
            editable: true,
            success: async (res) => {
                if (res.confirm) {
                    const amount = parseFloat(res.content);
                    if (isNaN(amount)) {
                        wx.showToast({
                            title: '请输入有效金额',
                            icon: 'none'
                        });
                        return;
                    }

                    try {
                        const sheetsAPI = await app.getSheetsAPI();
                        const newBalance = (parseFloat(user.balance) + amount).toFixed(2);

                        // 更新余额
                        await sheetsAPI.batchUpdate([{
                            range: `Record!D${user.rowIndex}`,
                            values: [[newBalance]]
                        }]);

                        // 更新本地数据
                        const users = [...this.data.users];
                        users[index].balance = newBalance;
                        this.setData({ users });

                        wx.showToast({
                            title: '调整成功',
                            icon: 'success'
                        });

                    } catch (err) {
                        console.error('调整余额失败:', err);
                        wx.showToast({
                            title: '调整失败',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    },

    // 修改用户列表项点击处理
    onUserTap: function(e) {
        const { index } = e.currentTarget.dataset;
        this.adjustBalance(e);  // 直接调用调整余额的方法
    }
})