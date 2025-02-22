const app = getApp();

class SignUpService {
  // 获取用户在表格中的行号
  async getUserRow(wechat) {
    try {
      const sheetsAPI = app.globalData.sheetsAPI;
      console.log('getUserRow 中的 sheetsAPI:', {
        hasSheets: !!sheetsAPI,
        sheetsAPIFunctions: Object.keys(sheetsAPI || {})
      });

      if (!sheetsAPI) {
        throw new Error('sheetsAPI 未初始化');
      }

      const users = await sheetsAPI.readSheet('Record!A:B');
      console.log('读取到的用户数据:', {
        total: users.length,
        sample: users.slice(8, 15),
        searchingFor: wechat
      });
      
      // 从第9行开始查找用户
      for (let i = 8; i < users.length; i++) {
        if (users[i][1] === wechat) {
          console.log('找到用户:', {
            row: i + 1,
            name: users[i][0],
            wechat: users[i][1]
          });
          return i + 1;
        }
      }

      console.log('未找到用户:', wechat);
      return null;
    } catch (err) {
      console.error('获取用户行号失败:', err);
      throw err;
    }
  }

  // 获取活动参与者信息
  async getActivityParticipants(columnRange) {
    try {
      if (!columnRange) {
        console.error('列标识为空:', columnRange);
        return [];
      }

      // 确保获取已初始化的 sheetsAPI
      const sheetsAPI = await app.getSheetsAPI();
      if (!sheetsAPI) {
        throw new Error('sheetsAPI 初始化失败');
      }
      
      // 获取列字母
      const match = columnRange.match(/^([A-Za-z]+)/);
      if (!match) {
        console.error('无效的列标识:', columnRange);
        return [];
      }

      const columnLetter = match[1];
      
      console.log('解析列标识:', {
        columnRange,
        columnLetter,
        hasSheets: !!sheetsAPI
      });
      
      // 获取报名数据（从第9行开始）
      const signUpRange = `${columnLetter}9:${columnLetter}200`;
      const signUps = await sheetsAPI.readSheet(`Record!${signUpRange}`);
      
      // 获取用户基本信息（姓名和微信号）
      const userInfoRange = 'A9:B200';
      const userInfo = await sheetsAPI.readSheet(`Record!${userInfoRange}`);
      
      console.log('获取到的原始数据:', {
        signUpRange,
        userInfoRange,
        signUpsLength: signUps?.length,
        userInfoLength: userInfo?.length,
        signUpSample: signUps?.slice(0, 5),
        userInfoSample: userInfo?.slice(0, 5)
      });

      // 处理数据
      const participants = [];
      if (signUps && userInfo) {
        for (let i = 0; i < signUps.length; i++) {
          // 检查是否有报名信息（不为空且不为0）
          const signUpValue = signUps[i]?.[0];
          if (signUpValue && signUpValue.toString().trim() !== '' && signUpValue !== '0') {
            const rowIndex = i + 9; // 计算实际行号（从第9行开始）
            participants.push({
              name: userInfo[i]?.[0],
              wechat: userInfo[i]?.[1],
              signUpNumber: signUpValue,
              rowIndex
            });
          }
        }
      }

      console.log('处理后的参与者数据:', {
        total: participants.length,
        participants,
        signUpColumn: columnLetter,
        hasParticipants: participants.length > 0,
        firstParticipant: participants[0]
      });

      return participants;

    } catch (err) {
      console.error('获取参与者信息失败:', err);
      return [];
    }
  }

  // 处理报名逻辑
  async signUp(activityColumn) {
    try {
      const sheetsAPI = app.globalData.sheetsAPI;
      console.log('检查 sheetsAPI:', {
        hasGlobalData: !!app.globalData,
        hasSheets: !!sheetsAPI,
        sheetsAPIFunctions: Object.keys(sheetsAPI || {})
      });

      // 1. 获取当前用户
      const currentUser = await app.getCurrentUser();
      console.log('当前用户:', currentUser);

      if (!currentUser) {
        throw new Error('请先登录');
      }

      // 2. 获取用户行号
      const userRow = await this.getUserRow(currentUser.wechat);
      console.log('获取到用户行号:', userRow);

      if (!userRow) {
        throw new Error('找不到用户信息');
      }

      // 3. 处理活动列标识
      const column = this.formatColumnRange(activityColumn);
      console.log('处理后的列范围:', column);

      // 4. 获取活动信息和参与者
      const [activityInfo, participants] = await Promise.all([
        sheetsAPI.getActivitySignUpInfo(column),
        this.getActivityParticipants(activityColumn)
      ]);

      if (!activityInfo.totalFee) {
        throw new Error('活动费用信息不完整');
      }

      // 5. 计算人均费用
      const perPersonFee = (activityInfo.totalFee / (participants.length + 1)).toFixed(2);
      console.log('费用计算:', {
        totalFee: activityInfo.totalFee,
        currentSignUps: participants.length,
        perPersonFee
      });

      // 6. 显示确认对话框
      const confirmResult = await new Promise((resolve) => {
        wx.showModal({
          title: '确认报名',
          content: `报名后每人需支付 ¥${perPersonFee}，是否确认报名？`,
          success: resolve
        });
      });

      if (!confirmResult.confirm) {
        return { success: false, cancelled: true };
      }

      // 7. 执行报名
      const result = await sheetsAPI.signUpActivity(activityColumn, userRow);
      
      // 8. 更新本地活动数据
      const activities = wx.getStorageSync('activities') || [];
      const activityIndex = activities.findIndex(a => a.column === activityColumn);
      if (activityIndex !== -1) {
        activities[activityIndex].participants = await this.getActivityParticipants(activityColumn);
        wx.setStorageSync('activities', activities);
      }

      return { success: true, ...result };

    } catch (err) {
      console.error('报名失败:', err);
      throw err;
    }
  }

  // 格式化列标识
  formatColumnRange(column) {
    // 分离列字母和数字
    const match = column.match(/^([A-Za-z]+)(\d*)$/);
    if (!match) {
      throw new Error('无效的列标识');
    }

    const [_, columnLetter] = match;
    
    // 构建正确的范围
    const range = `${columnLetter}2:${columnLetter}5`;

    console.log('列标识处理:', {
      original: column,
      columnLetter,
      range,
      match
    });

    return range;
  }

  /**
   * 报名活动
   * @param {string} columnRange 活动列范围
   * @param {number} userRow 用户行号
   */
  async signUpActivity(columnRange, userRow) {
    try {
      // 获取列字母
      const columnLetter = columnRange.match(/^([A-Za-z]+)/)[1];
      
      // 获取当前报名情况
      const signUpRange = `${columnLetter}6:${columnLetter}200`;
      const signUps = await this.readSheet(`Record!${signUpRange}`);
      
      console.log('报名数据:', {
        range: signUpRange,
        data: signUps,
        userRow,
        targetCell: `Record!${columnLetter}${userRow}`
      });

      // 检查用户是否已报名
      const userIndex = userRow - 6;
      if (signUps && signUps[userIndex] && signUps[userIndex][0]) {
        throw new Error('您已经报名了这个活动');
      }

      // 计算当前报名序号
      const currentSignUps = signUps ? signUps.filter(row => row[0] && row[0].toString().trim() !== '').length : 0;
      const signUpNumber = currentSignUps + 1;

      console.log('报名序号计算:', {
        currentSignUps,
        newNumber: signUpNumber,
        existingData: signUps?.map(row => row[0])
      });

      // 写入报名序号
      await this.updateCell(`Record!${columnLetter}${userRow}`, signUpNumber.toString());

      return {
        success: true,
        position: signUpNumber
      };

    } catch (err) {
      console.error('报名活动失败:', err);
      throw err;
    }
  }

  /**
   * 取消报名
   * @param {string} columnRange 活动列范围
   * @param {number} userRow 用户行号
   */
  async cancelSignUp(columnRange, userRow) {
    try {
      // 获取列字母
      const columnLetter = columnRange.match(/^([A-Za-z]+)/)[1];
      
      // 清空用户的报名数据
      await this.updateCell(`Record!${columnLetter}${userRow}`, '');

      return {
        success: true
      };

    } catch (err) {
      console.error('取消报名失败:', err);
      throw err;
    }
  }

  // 处理取消报名逻辑
  async cancelSignUp(activityColumn) {
    try {
      const sheetsAPI = app.globalData.sheetsAPI;
      if (!sheetsAPI) {
        throw new Error('sheetsAPI 未初始化');
      }
      
      // 1. 获取当前用户
      const currentUser = await app.getCurrentUser();
      if (!currentUser) {
        throw new Error('请先登录');
      }

      // 2. 获取用户行号
      const userRow = await this.getUserRow(currentUser.wechat);
      if (!userRow) {
        throw new Error('找不到用户信息');
      }

      // 3. 处理活动列标识
      const match = activityColumn.match(/^([A-Za-z]+)/);
      if (!match) {
        throw new Error('无效的列标识');
      }
      const columnLetter = match[1];

      console.log('取消报名:', {
        activityColumn,
        columnLetter,
        userRow,
        sheetsAPI: !!sheetsAPI
      });

      // 4. 清空用户的报名数据
      await sheetsAPI.updateCell(`Record!${columnLetter}${userRow}`, '');

      // 5. 更新本地活动数据
      const activities = wx.getStorageSync('activities') || [];
      const activityIndex = activities.findIndex(a => a.column === activityColumn);
      if (activityIndex !== -1) {
        // 重新获取参与者列表
        activities[activityIndex].participants = await this.getActivityParticipants(activityColumn);
        wx.setStorageSync('activities', activities);
      }

      return { success: true };

    } catch (err) {
      console.error('取消报名失败:', err);
      throw err;
    }
  }

  /**
   * 取消活动
   * @param {string} column 活动列标识
   * @returns {Promise<Object>} 取消结果
   */
  async cancelActivity(column) {
    try {
      const sheetsAPI = app.globalData.sheetsAPI;
      if (!sheetsAPI) {
        throw new Error('sheetsAPI 未初始化');
      }

      // 获取列字母
      const match = column.match(/^([A-Za-z]+)/);
      if (!match) {
        throw new Error('无效的列标识');
      }
      const columnLetter = match[1];

      console.log('取消活动:', {
        column,
        columnLetter,
        hasSheetsAPI: !!sheetsAPI
      });

      // 1. 更新活动状态为已取消
      await sheetsAPI.updateCell(`Record!${columnLetter}2`, 'cancelled');

      // 2. 获取当前报名数据
      const signUps = await sheetsAPI.readSheet(`Record!${columnLetter}6:${columnLetter}200`);
      
      // 3. 清空所有报名数据
      const clearPromises = [];
      for (let i = 0; i < signUps.length; i++) {
        if (signUps[i][0] && signUps[i][0].toString().trim() !== '') {
          const rowIndex = i + 6;
          clearPromises.push(
            sheetsAPI.updateCell(`Record!${columnLetter}${rowIndex}`, '')
          );
        }
      }
      
      if (clearPromises.length > 0) {
        await Promise.all(clearPromises);
      }

      return { success: true };

    } catch (err) {
      console.error('取消活动失败:', err);
      throw err;
    }
  }
}

export const signUpService = new SignUpService(); 