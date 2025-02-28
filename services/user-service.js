const { sheetsAPI } = require('../utils/sheets-api');

class UserService {
  // 根据微信号查找用户
  async findUserByWechat(wechat) {
    try {
      // 从第9行开始查找用户
      const users = await sheetsAPI.readSheet('Record!A:B');
      
      for (let i = 8; i < users.length; i++) {
        if (users[i][1] === wechat) {
          return {
            name: users[i][0],
            wechat: users[i][1],
            rowIndex: i + 1
          };
        }
      }
      return null;
    } catch (err) {
      console.error('查找用户失败:', err);
      throw err;
    }
  }

  // 创建新用户
  async createUser(userInfo) {
    try {
      const { name, wechat } = userInfo;
      
      // 获取最后一行
      const lastRow = await sheetsAPI.getLastRow('Record!A:B');
      
      // 添加新用户
      await sheetsAPI.appendRow('Record', [name, wechat]);
      
      return {
        name,
        wechat,
        rowIndex: lastRow + 1
      };
    } catch (err) {
      console.error('创建用户失败:', err);
      throw err;
    }
  }

  // 更新用户信息
  async updateUser(wechat, updates) {
    try {
      const user = await this.findUserByWechat(wechat);
      if (!user) {
        throw new Error('用户不存在');
      }

      const { name } = updates;
      if (name) {
        await sheetsAPI.updateCell(`Record!A${user.rowIndex}`, name);
      }

      return {
        ...user,
        ...updates
      };
    } catch (err) {
      console.error('更新用户失败:', err);
      throw err;
    }
  }
}

export const userService = new UserService(); 