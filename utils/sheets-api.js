/* exported gapiLoaded */
/* exported gisLoaded */
/* exported handleAuthClick */
/* exported handleSignoutClick */

import { GoogleAuth } from './jwt';
import { credentials } from './credentials';

const SPREADSHEET_ID = '1wXoirvjHN2KuWyvG_xf4bDpQiPN02Ug4925afc1uUTc';

// Authorization scopes required by the API
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/**
 * Google API 初始化类
 */
class SheetsAPI {
  constructor() {
    this.isInitialized = false;
    this.accessToken = null;
    this.SHEETS = {
      USER: 'Users',
      RECORD: 'Record',
      DEPOSIT: 'Deposit Record'
    };
    
    // 价格表配置
    this.PRICE_CONFIG = {
      SUMMER: {start: 4, end: 10},  // 夏季：4月-10月
      WINTER: {start: 11, end: 3},  // 冬季：11月-3月
      PEAK_HOURS: {start: 16, end: 24} // 高峰时段：16:00-24:00
    };

    this.FIXED_COLUMNS = 5;  // A=Name, B=Wechat, C=Deposit, D=Balance, E=Spent YTD
    
    // 添加费用记录起始列
    this.FEE_START_COLUMN = 6;  // F 列开始是费用记录

    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.spreadsheetId = '1wXoirvjHN2KuWyvG_xf4bDpQiPN02Ug4925afc1uUTc';

    this.auth = new GoogleAuth(credentials);

    // 表格结构配置
    this.SHEET_CONFIG = {
      RECORD: {
        FIXED_COLUMNS: {
          NAME: 'A',      // 姓名
          WECHAT: 'B',    // 微信号
          DATE: 'C',      // 日期
          BALANCE: 'D',   // 余额
          AMOUNT: 'E'     // 金额
        },
        TRANSACTIONS_START: 'F',  // 交易记录开始列
        TRANSACTIONS_END: 'ZZ',   // 交易记录结束列
        DATA_START_ROW: 2         // 数据开始行
      },
      DEPOSIT: {
        COLUMNS: {
          DATE: 'A',      // 充值日期
          WECHAT: 'B',    // 微信号
          AMOUNT: 'C',    // 充值金额
          METHOD: 'D'     // 充值方式
        },
        DATA_START_ROW: 2
      }
    };

    // 添加缓存配置
    this.CACHE_CONFIG = {
      USERS: {
        KEY: 'cached_users',
        EXPIRE_TIME: 5 * 60 * 1000  // 5分钟过期
      }
    };

    // 缓存数据
    this.cache = {
      users: null,
      lastUpdate: null
    };
  }

  /**
   * 获取交易记录范围
   */
  getTransactionsRange() {
    const config = this.SHEET_CONFIG.RECORD;
    return `${this.SHEETS.RECORD}!${config.TRANSACTIONS_START}${config.DATA_START_ROW}:${config.TRANSACTIONS_END}`;
  }

  /**
   * 加载交易记录
   */
  async loadTransactions() {
    try {
      const range = this.getTransactionsRange();
      console.log('读取交易记录范围:', range);
      const data = await this.readSheet(range);
      return data || [];
    } catch (err) {
      console.error('加载交易记录失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户余额
   */
  async getUserBalance(wechatId) {
    try {
      const config = this.SHEET_CONFIG.RECORD;
      const range = `${this.SHEETS.RECORD}!${config.FIXED_COLUMNS.NAME}${config.DATA_START_ROW}:${config.FIXED_COLUMNS.BALANCE}`;
      const data = await this.readSheet(range);
      
      if (!data || data.length === 0) return '0.00';
      
      // 从后往前查找该用户的最新余额记录
      for (let i = data.length - 1; i >= 0; i--) {
        const row = data[i];
        // 检查是否是目标用户且有余额数据
        if (row[1] === wechatId && row[3]) {  // B列是微信ID，D列是余额
          return parseFloat(row[3]).toFixed(2);
        }
      }
      
      return '0.00';
    } catch (err) {
      console.error('获取用户余额失败:', err);
      return '0.00';
    }
  }

  /**
   * 初始化 Google API
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      await this.getAccessToken();
      
      // 获取实际的表信息
      const sheetInfo = await this.getSpreadsheetInfo();
      console.log('获取到的表信息:', sheetInfo);
      
      // 根据表名匹配正确的映射
      const findSheet = (namePatterns) => {
        for (const pattern of namePatterns) {
          const sheet = sheetInfo.find(sheet => 
            sheet.title.toLowerCase().includes(pattern.toLowerCase())
          );
          if (sheet) return sheet.title;
        }
        return '';
      };
      
      console.log('使用的表名:', this.SHEETS);
      
      // 验证所有表是否都找到
      for (const [key, value] of Object.entries(this.SHEETS)) {
        if (!value) {
          // 输出更详细的错误信息
          console.error('表名匹配失败:', {
            key,
            availableSheets: sheetInfo.map(s => s.title),
            currentMapping: this.SHEETS
          });
          throw new Error(`找不到表: ${key}`);
        }
      }
      
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('初始化失败:', err);
      throw err;
    }
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    try {
      this.accessToken = await this.auth.getAccessToken();
      return this.accessToken;
    } catch (err) {
      console.error('获取token失败:', err);
      throw err;
    }
  }

  /**
   * 读取表格数据
   */
  async readSheet(range) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    // 对范围进行编码
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;
    
    console.log('读取范围:', range);
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        },
        success: (res) => {
          console.log('API完整响应:', res);
          
          if (res.statusCode === 200) {
            // 检查响应数据结构
            if (res.data && res.data.values) {
              console.log('读取到的数据:', res.data.values);
              resolve(res.data.values);
            } else {
              console.warn('API返回数据为空:', res.data);
              resolve([]);
            }
          } else {
            console.error('Sheets API错误:', {
              statusCode: res.statusCode,
              data: res.data,
              range: range,
              url: url
            });
            reject(new Error(`API请求失败: ${res.statusCode} - ${JSON.stringify(res.data)}`));
          }
        },
        fail: (err) => {
          console.error('请求失败:', err);
          reject(err);
        }
      });
    });
  }

  /**
   * 写入表格数据
   * @param {string} range 范围（如 'Record!A1'）
   * @param {Array<Array<string>>} values 要写入的值
   */
  async writeSheet(range, values) {
    try {
      if (!this.accessToken) {
        await this.getAccessToken();
      }

      console.log('写入数据:', {
        range,
        values,
        url: `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`
      });

      // 使用 Promise 包装 wx.request
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            range: range,
            majorDimension: "ROWS",
            values: values
          },
          success: resolve,
          fail: reject
        });
      });

      if (response.statusCode !== 200) {
        throw new Error(`API请求失败: ${response.statusCode} - ${JSON.stringify(response.data)}`);
      }

      return true;

    } catch (err) {
      console.error('写入数据失败:', err);
      throw err;
    }
  }

  /**
   * 追加表格数据
   * @param {string} range - 要追加的范围
   * @param {Array} values - 要追加的数据
   */
  async appendSheet(range, values) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          range: range,
          majorDimension: "ROWS",
          values: values
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`API请求失败: ${res.statusCode} - ${JSON.stringify(res.data)}`));
          }
        },
        fail: reject
      });
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // 使用完整的表名和范围
      const testRange = `'${this.SHEETS.RECORD}'!A1:E1`;
      console.log('测试读取范围:', testRange);
      
      const readResult = await this.readSheet(testRange);
      console.log('读取测试数据:', readResult);
      
      if (!readResult || readResult.length === 0) {
        console.warn('读取结果为空，请检查表名和范围是否正确');
        // 输出所有可用的表名
        const sheetInfo = await this.getSpreadsheetInfo();
        console.log('所有可用的表:', sheetInfo.map(s => s.title));
      }
      
      return true;
    } catch (err) {
      console.error('API测试失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户信息
   * @param {string} wechat - 微信名
   */
  async getUser(wechat) {
    const range = `${this.SHEETS.RECORD}!A:E`;
    const values = await this.readSheet(range);
    
    // 查找用户行
    const userRow = values.find(row => row[1] === wechat);
    if (!userRow) return null;

    return {
      name: userRow[0],
      wechat: userRow[1],
      deposit: parseFloat(userRow[2] || 0),
      balance: parseFloat(userRow[3] || 0),
      spentYTD: parseFloat(userRow[4] || 0)
    };
  }

  /**
   * 更新用户余额
   * @param {string} wechat - 微信名
   * @param {number} amount - 金额（正数为充值，负数为消费）
   */
  async updateBalance(wechat, amount) {
    const range = `${this.SHEETS.RECORD}!A:E`;
    const values = await this.readSheet(range);
    
    // 查找用户行号
    const rowIndex = values.findIndex(row => row[1] === wechat);
    if (rowIndex === -1) throw new Error('用户不存在');

    const currentBalance = parseFloat(values[rowIndex][3] || 0);
    const currentSpentYTD = parseFloat(values[rowIndex][4] || 0);
    
    // 计算新的余额和支出
    const newBalance = currentBalance + amount;
    const newSpentYTD = amount < 0 ? currentSpentYTD - amount : currentSpentYTD;

    // 更新余额和支出
    await this.writeSheet(
      `${this.SHEETS.RECORD}!D${rowIndex + 1}:E${rowIndex + 1}`,
      [[newBalance, newSpentYTD]]
    );
  }

  /**
   * 记录活动参与
   * @param {string} date - 活动日期 YYYY-MM-DD
   * @param {number} fee - 人均费用
   * @param {string[]} participants - 参与者微信名列表
   */
  async recordActivity(date, fee, participants) {
    // 1. 获取表头找到日期列或创建新列
    const headerRange = `${this.SHEETS.RECORD}!1:1`;
    const headers = await this.readSheet(headerRange);
    
    let dateColIndex = headers[0].indexOf(date);
    if (dateColIndex === -1) {
      // 添加新日期列
      dateColIndex = headers[0].length;
      await this.writeSheet(
        `${this.SHEETS.RECORD}!${this.columnToLetter(dateColIndex)}1`,
        [[date]]
      );
    }

    // 2. 获取所有用户数据
    const range = `${this.SHEETS.RECORD}!A:${this.columnToLetter(dateColIndex)}`;
    const values = await this.readSheet(range);

    // 3. 更新参与者费用和余额
    for (const wechat of participants) {
      const rowIndex = values.findIndex(row => row[1] === wechat);
      if (rowIndex === -1) continue;

      // 记录费用
      await this.writeSheet(
        `${this.SHEETS.RECORD}!${this.columnToLetter(dateColIndex)}${rowIndex + 1}`,
        [[fee]]
      );

      // 更新余额
      await this.updateBalance(wechat, -fee);
    }
  }

  /**
   * 获取用户活动历史
   * @param {string} wechat - 微信名
   * @param {number} limit - 最近几次活动，默认10次
   */
  async getUserActivities(wechat, limit = 10) {
    // 获取表头
    const headerRange = `${this.SHEETS.RECORD}!1:1`;
    const headers = await this.readSheet(headerRange);
    const dates = headers[0].slice(this.FIXED_COLUMNS);

    // 获取用户数据
    const range = `${this.SHEETS.RECORD}!A:${this.columnToLetter(headers[0].length)}`;
    const values = await this.readSheet(range);
    const userRow = values.find(row => row[1] === wechat);
    
    if (!userRow) return [];

    // 提取活动记录
    const activities = dates.map((date, index) => ({
      date,
      fee: parseFloat(userRow[this.FIXED_COLUMNS + index] || 0)
    })).filter(activity => activity.fee > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

    return activities;
  }

  // 辅助方法：将列号转换为字母
  columnToLetter(column) {
    let temp, letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }

  /**
   * 记录押金变动
   * @param {Object} deposit 押金信息
   * @param {string} deposit.wechat - 微信ID
   * @param {number} deposit.amount - 金额
   * @param {string} deposit.type - 支付方式(Cash/ET)
   */
  async recordDeposit(deposit) {
    const date = new Date().toLocaleDateString('en-US');
    const range = `${this.SHEETS.DEPOSIT}!A:D`;
    
    // 添加新的押金记录
    await this.appendSheet(range, [[
      date,
      deposit.wechat,
      deposit.amount.toFixed(2),
      deposit.type
    ]]);

    // 同步更新主表的押金和余额
    await this.updateUserDeposit(deposit.wechat, deposit.amount);
  }

  /**
   * 更新用户押金
   * @private
   */
  async updateUserDeposit(wechat, amount) {
    const user = await this.getUser(wechat);
    if (!user) throw new Error('用户不存在');

    const newDeposit = (parseFloat(user.deposit) || 0) + amount;
    const newBalance = (parseFloat(user.balance) || 0) + amount;

    const range = `${this.SHEETS.RECORD}!A:E`;
    const values = await this.readSheet(range);
    const rowIndex = values.findIndex(row => row[1] === wechat);

    await this.writeSheet(
      `${this.SHEETS.RECORD}!C${rowIndex + 1}:D${rowIndex + 1}`,
      [[newDeposit, newBalance]]
    );
  }

  /**
   * 计算活动费用
   * @param {Object} activity 活动信息
   * @param {string} activity.date - 日期 YYYY-MM-DD
   * @param {string} activity.time - 时间段 HH:mm-HH:mm
   * @param {string} activity.field - 场地编号
   * @param {string[]} activity.participants - 参与者微信ID列表
   */
  async calculateActivityFee(activity) {
    // 1. 更新费用计算表
    await this.updateFeecalcu(activity);
    
    // 2. 获取计算结果
    const range = `${this.SHEETS.FEECALCU}!A5:C5`;
    const [[, fieldFee]] = await this.readSheet(range);
    
    const memberRange = `${this.SHEETS.FEECALCU}!A10:B60`;
    const members = await this.readSheet(memberRange);
    const participantCount = members.filter(m => m[1] === 'TRUE').length;
    
    const feePerPerson = fieldFee / participantCount;

    // 3. 记录活动
    await this.recordActivity(activity.date, feePerPerson, activity.participants);

    return {
      totalFee: fieldFee,
      feePerPerson,
      participantCount
    };
  }

  /**
   * 获取用户押金记录
   * @param {string} wechat - 微信ID
   */
  async getDepositHistory(wechat) {
    const range = `${this.SHEETS.DEPOSIT}!A:D`;
    const values = await this.readSheet(range);
    
    return values
      .filter(row => row[1] === wechat)
      .map(row => ({
        date: row[0],
        amount: parseFloat(row[2]),
        type: row[3]
      }));
  }

  /**
   * 获取价格表
   * @param {Date} date - 活动日期
   * @param {string} timeSlot - 时间段 HH:mm-HH:mm
   */
  async getPriceTable(date, timeSlot) {
    const month = date.getMonth() + 1;
    const day = date.getDay();
    const [startHour] = timeSlot.split('-')[0].split(':').map(Number);

    const isWinter = month >= this.PRICE_CONFIG.WINTER.start || 
                    month <= this.PRICE_CONFIG.WINTER.end;
    const isWeekend = day === 0 || day === 6;
    const isPeakHour = startHour >= this.PRICE_CONFIG.PEAK_HOURS.start;

    const range = `${this.SHEETS.FEECALCU}!A1:C4`;
    const prices = await this.readSheet(range);

    // 根据条件返回对应价格
    return this.calculatePrice(prices, isWinter, isWeekend, isPeakHour);
  }

  /**
   * 获取用户完整信息
   * @param {string} wechat - 微信名
   */
  async getUserFullInfo(wechat) {
    // 1. 获取基本信息
    const user = await this.getUser(wechat);
    if (!user) return null;

    // 2. 获取押金记录
    const depositHistory = await this.getDepositHistory(wechat);

    // 3. 获取活动记录
    const activities = await this.getUserActivities(wechat);

    return {
      ...user,
      depositHistory,
      activities
    };
  }

  /**
   * 获取所有表名
   */
  async getSheetNames() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const sheets = res.data.sheets || [];
            const sheetNames = sheets.map(sheet => sheet.properties.title);
            console.log('可用的表名:', sheetNames);
            resolve(sheetNames);
          } else {
            reject(new Error(`获取表名失败: ${res.statusCode}`));
          }
        },
        fail: reject
      });
    });
  }

  /**
   * 获取电子表格信息
   */
  async getSpreadsheetInfo() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            console.log('电子表格完整信息:', res.data);
            const sheets = res.data.sheets || [];
            const sheetInfo = sheets.map(sheet => ({
              title: sheet.properties.title,
              sheetId: sheet.properties.sheetId,
              index: sheet.properties.index
            }));
            console.log('所有表信息:', sheetInfo);
            resolve(sheetInfo);
          } else {
            reject(new Error(`获取表格信息失败: ${res.statusCode}`));
          }
        },
        fail: reject
      });
    });
  }

  /**
   * 获取所有用户列表
   */
  async getAllUsers() {
    const range = `${this.SHEETS.RECORD}!A2:E`;  // 从第2行开始,跳过表头
    const values = await this.readSheet(range);
    
    return values.map(row => ({
      name: row[0],
      wechat: row[1],
      deposit: parseFloat(row[2] || 0),
      balance: parseFloat(row[3] || 0),
      spentYTD: parseFloat(row[4] || 0)
    })).filter(user => user.wechat); // 过滤掉空行
  }

  /**
   * 获取所有活动列表
   * @param {number} limit - 最近几次活动，默认20次
   */
  async getActivities(limit = 20) {
    try {
      // 读取活动信息区域 (F2:HU5)
      const range = `${this.SHEETS.RECORD}!F2:HU5`;
      console.log('正在读取活动数据, 范围:', range);
      
      const values = await this.readSheet(range);
      console.log('读取到的原始数据:', values);
      
      if (!values || values.length < 4) {
        console.error('活动数据格式不正确');
        return [];
      }

      const [dates, fields, timeSlots, fees] = values;
      
      // 获取参与者数据
      const participantsRange = `${this.SHEETS.RECORD}!A:HU`;
      const allData = await this.readSheet(participantsRange);
      console.log('读取到的完整数据:', allData);

      // 从第9行开始是用户数据
      const userData = allData.slice(8);

      // 处理成活动卡片需要的格式
      const DEFAULT_MAX_PARTICIPANTS = 16; // 设置默认最大参与人数
      const activities = dates.map((date, index) => {
        // 如果日期为空或者为 'cancelled'，跳过这个活动
        if (!date || date === 'cancelled') return null;

        // 解析场地和人数信息
        const fieldInfo = fields[index] || '';
        let field = '', maxParticipants = DEFAULT_MAX_PARTICIPANTS;

        if (fieldInfo) {
          const matches = fieldInfo.match(/(\d+)号场\s*-\s*(\d+)人/);
          if (matches) {
            field = matches[1];
            maxParticipants = parseInt(matches[2], 10);
          } else {
            field = fieldInfo;
          }
        }

        // 计算列标识（从F开始）
        const columnLetter = String.fromCharCode(70 + index); // F的ASCII码是70

        // 计算参与者
        const participants = userData
          .filter(row => {
            const fee = parseFloat(row[this.FEE_START_COLUMN - 1 + index] || 0);
            return fee > 0;
          })
          .map((row, signUpIndex) => ({
            name: row[0] || '',
            wechat: row[1] || '',
            fee: parseFloat(row[this.FEE_START_COLUMN - 1 + index] || 0),
            signUpNumber: signUpIndex + 1,
            rowIndex: 9 + signUpIndex,
            checkedIn: true  // 付费即视为签到
          }))
          .filter(p => p.wechat && p.fee > 0);

        // 计算总费用和人均费用
        const totalFee = parseFloat(fees[index] || 0);
        const perPersonFee = participants.length > 0 ? 
          Math.round((totalFee / participants.length) * 100) / 100 : 0;

        // 格式化日期
        const dateObj = new Date(date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2'));
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const displayDate = `${month}月${day}日`;
        const isUpcoming = dateObj > new Date();
        const status = isUpcoming ? 'upcoming' : 'completed';

        // 生成活动名称
        const name = `${displayDate} - 足球`;

        // 生成唯一ID
        const uniqueId = [
          date.replace(/\//g, ''),
          field || 'nf',
          timeSlots[index]?.replace(/[:-]/g, '') || 'nt',
          index.toString().padStart(3, '0')
        ].join('-');

        return {
          id: uniqueId,
          name: name,
          date: date,
          displayDate: displayDate,
          field: field,
          maxParticipants: maxParticipants,
          startTime: timeSlots[index]?.split('-')[0] || '',
          endTime: timeSlots[index]?.split('-')[1] || '',
          totalFee: totalFee,
          perPersonFee: perPersonFee,
          participants: participants,
          participantCount: participants.length,
          status: status,
          type: '足球',
          coverImage: '/assets/images/covers/default.webp',
          column: columnLetter,  // 添加列标识
          isFull: participants.length >= maxParticipants
        };
      })
      .filter(activity => {
        if (!activity) return false;
        if (!activity.date) return false;
        if (!activity.totalFee || activity.totalFee <= 0) return false;
        if (!activity.participants || !Array.isArray(activity.participants)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

      console.log('处理后的活动数据:', activities.map(a => ({
        id: a.id,
        name: a.name,
        participantCount: a.participantCount,
        perPersonFee: a.perPersonFee,
        column: a.column,
        status: a.status
      })));

      return activities;
    } catch (err) {
      console.error('获取活动列表失败:', err);
      return [];
    }
  }

  /**
   * 获取所有押金记录
   * @param {number} limit - 最近几条记录，默认50条
   */
  async getDepositRecords(limit = 50) {
    const range = `${this.SHEETS.DEPOSIT}!A2:D`; // 从第2行开始,跳过表头
    const values = await this.readSheet(range);
    
    return values
      .map(row => ({
        date: row[0],
        wechat: row[1],
        amount: parseFloat(row[2] || 0),
        type: row[3]  // Cash/ET
      }))
      .filter(record => record.wechat) // 过滤掉空行
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // 按日期倒序
      .slice(0, limit);
  }

  /**
   * 获取用户签到记录
   * @param {string} wechat - 微信ID
   * @param {number} limit - 最近几次记录，默认10次
   */
  async getUserCheckIns(wechat, limit = 10) {
    const activities = await this.getActivities(limit);
    
    return activities
      .filter(activity => 
        activity.participants.some(p => p.wechat === wechat)
      )
      .map(activity => ({
        date: activity.date,
        fee: activity.participants.find(p => p.wechat === wechat).fee
      }));
  }

  /**
   * 获取完整用户清单及余额
   */
  async getUserBalances() {
    try {
      // 1. 从 Deposit Record 表读取所有充值记录
      const depositRange = `${this.SHEETS.DEPOSIT}!A2:D`;
      const depositRecords = await this.readSheet(depositRange);
      
      // 创建用户充值映射
      const userDeposits = {};
      depositRecords.forEach(record => {
        const [date, wechat, amount, type] = record;
        if (!wechat) return;
        
        if (!userDeposits[wechat]) {
          userDeposits[wechat] = {
            totalDeposit: 0,
            records: []
          };
        }
        
        const depositAmount = parseFloat(amount || 0);
        userDeposits[wechat].totalDeposit += depositAmount;
        userDeposits[wechat].records.push({
          date,
          amount: depositAmount,
          type
        });
      });

      // 2. 从 Record 表读取用户基本信息和消费记录
      const userRange = `${this.SHEETS.RECORD}!A9:HU`;
      const userData = await this.readSheet(userRange);
      
      // 创建用户消费映射
      const userSpending = {};
      userData.forEach(row => {
        const name = row[0];
        const wechat = row[1];
        if (!wechat) return;

        // 从第6列开始是活动费用
        const activityFees = row.slice(this.FIXED_COLUMNS).map(fee => parseFloat(fee || 0));
        const totalSpent = activityFees.reduce((sum, fee) => sum + fee, 0);

        userSpending[wechat] = {
          name,
          totalSpent,
          activityCount: activityFees.filter(fee => fee > 0).length,
          activities: activityFees.map((fee, index) => ({
            fee,
            index
          })).filter(a => a.fee > 0)
        };
      });

      // 3. 合并用户信息
      const users = new Map();
      
      // 添加所有充值用户
      Object.entries(userDeposits).forEach(([wechat, deposit]) => {
        users.set(wechat, {
          wechat,
          name: userSpending[wechat]?.name || '',
          totalDeposit: deposit.totalDeposit,
          totalSpent: userSpending[wechat]?.totalSpent || 0,
          balance: deposit.totalDeposit - (userSpending[wechat]?.totalSpent || 0),
          activityCount: userSpending[wechat]?.activityCount || 0,
          depositRecords: deposit.records,
          activities: userSpending[wechat]?.activities || []
        });
      });

      // 添加所有消费用户
      Object.entries(userSpending).forEach(([wechat, spending]) => {
        if (!users.has(wechat)) {
          users.set(wechat, {
            wechat,
            name: spending.name,
            totalDeposit: 0,
            totalSpent: spending.totalSpent,
            balance: -spending.totalSpent,
            activityCount: spending.activityCount,
            depositRecords: [],
            activities: spending.activities
          });
        }
      });

      // 转换为数组并排序
      const userList = Array.from(users.values())
        .sort((a, b) => b.activityCount - a.activityCount);

      console.log('用户数据汇总:', userList);
      return userList;

    } catch (err) {
      console.error('获取用户余额失败:', err);
      return [];
    }
  }

  /**
   * 获取用户活动详情
   * @param {string} wechat - 用户微信ID
   */
  async getUserActivityDetails(wechat) {
    try {
      // 1. 获取活动日期和费用信息 (从 F2 开始)
      const headerRange = `${this.SHEETS.RECORD}!F2:HU5`;
      const [dates, fields, timeSlots, fees] = await this.readSheet(headerRange);

      // 2. 获取用户参与记录
      const userRange = `${this.SHEETS.RECORD}!A9:HU`;
      const userData = await this.readSheet(userRange);
      
      // 找到用户的行
      const userRow = userData.find(row => row[1] === wechat);
      if (!userRow) return null;

      // 3. 处理用户活动记录 (从第 6 列开始)
      const activities = userRow.slice(this.FEE_START_COLUMN - 1)  // 减 1 因为数组索引从 0 开始
        .map((fee, index) => {
          if (!fee || parseFloat(fee) === 0) return null;
          
          return {
            date: dates[index],
            field: fields[index],
            timeSlot: timeSlots[index],
            totalFee: parseFloat(fees[index] || 0),
            userFee: parseFloat(fee)
          };
        })
        .filter(activity => activity !== null)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      // 4. 获取用户充值记录
      const depositRange = `${this.SHEETS.DEPOSIT}!A2:D`;
      const depositRecords = await this.readSheet(depositRange);
      
      const deposits = depositRecords
        .filter(record => record[1] === wechat)
        .map(record => ({
          date: record[0],
          amount: parseFloat(record[2] || 0),
          type: record[3]
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      // 5. 计算统计信息
      const stats = {
        totalDeposit: deposits.reduce((sum, record) => sum + record.amount, 0),
        totalSpent: activities.reduce((sum, activity) => sum + activity.userFee, 0),
        activityCount: activities.length,
        averageFee: activities.length > 0 ? 
          activities.reduce((sum, activity) => sum + activity.userFee, 0) / activities.length : 0,
        // 添加更多统计信息
        firstActivityDate: activities.length > 0 ? activities[activities.length - 1].date : null,
        lastActivityDate: activities.length > 0 ? activities[0].date : null,
        maxFee: activities.length > 0 ? Math.max(...activities.map(a => a.userFee)) : 0,
        minFee: activities.length > 0 ? Math.min(...activities.map(a => a.userFee)) : 0
      };
      stats.balance = stats.totalDeposit - stats.totalSpent;

      return {
        name: userRow[0],
        wechat,
        stats,
        activities,
        deposits,
        rawFees: userRow.slice(this.FEE_START_COLUMN - 1)  // 添加原始费用数据用于调试
      };

    } catch (err) {
      console.error('获取用户活动详情失败:', err);
      return null;
    }
  }

  /**
   * 格式化日期
   * @private
   */
  formatDate(dateStr) {
    try {
      if (!dateStr) return '';
      
      // 检查日期格式
      if (typeof dateStr !== 'string') {
        console.warn('日期格式不正确:', dateStr);
        return '';
      }

      // 处理不同的日期格式
      if (dateStr.includes('/')) {
        // 处理 MM/DD/YYYY 格式
        const [month, day, year] = dateStr.split('/');
        if (!month || !day || !year) {
          console.warn('日期格式不完整:', dateStr);
          return dateStr;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else if (dateStr.includes('-')) {
        // 已经是 YYYY-MM-DD 格式
        return dateStr;
      } else {
        // 其他格式，尝试用 Date 对象处理
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn('无法解析的日期格式:', dateStr);
          return dateStr;
        }
        return date.toISOString().split('T')[0];
      }
    } catch (err) {
      console.error('格式化日期失败:', err, dateStr);
      return dateStr || '';
    }
  }

  /**
   * 创建新活动
   * @param {Object} activity 活动数据
   * @param {string} activity.date 活动日期 (格式: YYYY-MM-DD)
   * @param {string} activity.field 场地编号
   * @param {number} activity.maxParticipants 人数上限
   * @param {string} activity.startTime 开始时间
   * @param {string} activity.endTime 结束时间
   * @param {number} activity.totalFee 总费用
   */
  async createActivity(activity) {
    try {
      if (!this.accessToken) {
        await this.getAccessToken();
      }

      // 1. 获取电子表格信息，找到 Record 表的 sheetId
      const sheets = await this.getSpreadsheetInfo();
      const recordSheet = sheets.find(s => s.title === 'Record');
      if (!recordSheet) {
        throw new Error('找不到 Record 表');
      }

      // 2. 插入新列
      const insertColumnRequest = {
        requests: [{
          insertDimension: {
            range: {
              sheetId: recordSheet.sheetId,
              dimension: "COLUMNS",
              startIndex: 5,  // F列的索引是5
              endIndex: 6     // 插入一列
            }
          }
        }]
      };

      // 发送插入列的请求
      await new Promise((resolve, reject) => {
        wx.request({
          url: `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: insertColumnRequest,
          success: (res) => {
            console.log('插入列响应:', res);
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject(new Error(`插入新列失败: ${res.statusCode} - ${JSON.stringify(res.data)}`));
            }
          },
          fail: (err) => {
            console.error('插入列请求失败:', err);
            reject(err);
          }
        });
      });

      // 3. 复制格式（作为单独的请求）
      const copyFormatRequest = {
        requests: [{
          copyPaste: {
            source: {
              sheetId: recordSheet.sheetId,
              startRowIndex: 0,
              endRowIndex: 1000,
              startColumnIndex: 6,
              endColumnIndex: 7
            },
            destination: {
              sheetId: recordSheet.sheetId,
              startRowIndex: 0,
              endRowIndex: 1000,
              startColumnIndex: 5,
              endColumnIndex: 6
            },
            pasteType: "PASTE_FORMAT"
          }
        }]
      };

      // 发送复制格式请求
      await new Promise((resolve, reject) => {
        wx.request({
          url: `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: copyFormatRequest,
          success: (res) => {
            console.log('复制格式响应:', res);
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject(new Error(`复制格式失败: ${res.statusCode} - ${JSON.stringify(res.data)}`));
            }
          },
          fail: (err) => {
            console.error('复制格式请求失败:', err);
            reject(err);
          }
        });
      });

      // 4. 准备活动数据
      const dateObj = new Date(activity.date);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      const fieldInfo = `${activity.field}号场 - ${activity.maxParticipants}人`;
      const timeSlot = `${activity.startTime}-${activity.endTime}`;

      // 5. 写入活动数据
      const values = [
        [formattedDate],             // F2: 日期
        [fieldInfo],                 // F3: 场地-人数
        [timeSlot],                  // F4: 时间段
        [activity.totalFee.toString()] // F5: 总费用
      ];

      // 6. 写入数据
      await this.writeSheet('Record!F2:F5', values);

      // 7. 验证数据写入
      const verifyData = await this.readSheet('Record!F2:F5');
      
      console.log('验证数据:', {
        written: values,
        verified: verifyData
      });

      // 检查写入的数据是否匹配
      const isDataCorrect = verifyData && 
        verifyData[0]?.[0] === formattedDate &&
        verifyData[1]?.[0] === fieldInfo &&
        verifyData[2]?.[0] === timeSlot &&
        verifyData[3]?.[0] === activity.totalFee.toString();

      if (!isDataCorrect) {
        throw new Error('活动创建成功但数据验证失败');
      }

      return true;

    } catch (err) {
      console.error('创建活动失败:', err);
      throw err;
    }
  }

  /**
   * 获取活动报名信息
   * @param {string} columnRange 活动列范围
   */
  async getActivitySignUpInfo(columnRange) {
    try {
      console.log('获取活动信息:', {
        columnRange,
        sheet: 'Record'
      });

      // 读取活动信息
      const data = await this.readSheet(`Record!${columnRange}`);
      console.log('读取到的活动数据:', data);

      if (!data || data.length < 4) {
        throw new Error('活动不存在');
      }

      // 解析活动信息
      const [date, field, timeSlot, fee] = data.map(row => row[0]);
      const totalFee = parseFloat(fee) || 0;

      // 获取当前报名人数（直接从第6行开始读取）
      const columnLetter = columnRange.match(/^([A-Za-z]+)/)[1];
      const signUpRange = `${columnLetter}6:${columnLetter}200`;
      const signUps = await this.readSheet(`Record!${signUpRange}`);
      const currentSignUps = signUps.filter(row => row[0] && row[0].toString().trim() !== '').length;

      console.log('活动信息解析结果:', {
        date,
        field,
        timeSlot,
        totalFee,
        currentSignUps,
        signUpsData: signUps
      });

      return {
        totalFee,
        currentSignUps,
        maxSignUps: 16 // 默认最大人数
      };

    } catch (err) {
      console.error('获取活动报名信息失败:', err);
      throw err;
    }
  }

  /**
   * 更新单个单元格的值
   * @param {string} range 单元格范围（如 'Record!F6'）
   * @param {string} value 要写入的值
   */
  async updateCell(range, value) {
    try {
      if (!this.accessToken) {
        await this.getAccessToken();
      }

      console.log('更新单元格:', {
        range,
        value,
        url: `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`
      });

      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            range: range,
            majorDimension: "ROWS",
            values: [[value]]
          },
          success: resolve,
          fail: reject
        });
      });

      if (response.statusCode !== 200) {
        throw new Error(`API请求失败: ${response.statusCode} - ${JSON.stringify(response.data)}`);
      }

      // 验证更新
      const verifyData = await this.readSheet(range);
      
      // 处理空值的情况
      if (value === '') {
        // 如果要清空单元格，verifyData 可能是 undefined、null、空数组或者包含空值
        const isEmptyCell = !verifyData || 
                           verifyData.length === 0 || 
                           !verifyData[0] || 
                           verifyData[0].length === 0 ||
                           verifyData[0][0] === '' ||
                           verifyData[0][0] === null ||
                           verifyData[0][0] === undefined;
                           
        if (!isEmptyCell) {
          console.error('清空单元格验证失败:', {
            expected: '',
            actual: verifyData
          });
          throw new Error('数据清空验证失败');
        }
      } else {
        // 非空值的验证
        if (!verifyData || !verifyData[0] || verifyData[0][0] !== value) {
          console.error('写入数据验证失败:', {
            expected: value,
            actual: verifyData
          });
          throw new Error('数据写入验证失败');
        }
      }

      return true;

    } catch (err) {
      console.error('更新单元格失败:', err);
      throw err;
    }
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

      // 计算当前报名序号（计算已有多少人报名）
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
   * 保存签到结果
   */
  async saveCheckInResults(activityColumn, participants) {
    try {
      // 获取列字母
      const columnLetter = activityColumn.match(/^([A-Za-z]+)/)[1];
      console.log('解析活动列标识:', {
        activityColumn,
        columnLetter
      });
      
      // 获取活动信息（包括总费用）
      const activityInfo = await this.readSheet(`Record!${columnLetter}2:${columnLetter}5`);
      const totalFee = parseFloat(activityInfo[3][0]) || 0;
      
      // 计算实际签到人数和人均费用
      const checkedInCount = participants.filter(p => p.checkedIn).length;
      const perPersonFee = (totalFee / Math.max(checkedInCount, 1)).toFixed(2);

      console.log('费用计算:', {
        totalFee,
        checkedInCount,
        perPersonFee
      });

      // 准备批量更新数据
      const updates = [];
      for (const participant of participants) {
        // 构建更新值
        let updateValue;
        if (participant.checkedIn) {
          // 已签到，写入人均费用
          updateValue = perPersonFee.toString();
        } else {
          // 未签到，标记为未到
          updateValue = '未到';
        }

        const updateRange = `Record!${columnLetter}${participant.rowIndex}`;
        
        console.log('处理签到状态:', {
          participant: participant.name,
          checkedIn: participant.checkedIn,
          newValue: updateValue,
          range: updateRange
        });

        updates.push({
          range: updateRange,
          values: [[updateValue]]
        });
      }

      console.log('需要更新的数据:', {
        totalUpdates: updates.length,
        updates,
        totalFee,
        perPersonFee
      });

      // 如果有需要更新的数据
      if (updates.length > 0) {
        // 使用批量更新API
        await this.batchUpdate(updates);
        console.log('批量更新完成');
      } else {
        console.log('没有需要更新的数据');
      }

      return { 
        success: true,
        checkedInCount,
        perPersonFee
      };

    } catch (err) {
      console.error('保存签到结果失败:', err);
      throw err;
    }
  }

  /**
   * 批量更新单元格
   */
  async batchUpdate(updates) {
    try {
      if (!this.accessToken) {
        console.log('获取新的访问令牌...');
        await this.getAccessToken();
      }

      const data = {
        valueInputOption: 'RAW',
        data: updates.map(update => ({
          range: update.range,
          values: update.values
        }))
      };

      console.log('准备批量更新请求:', {
        url: `${this.baseUrl}/${this.spreadsheetId}/values:batchUpdate`,
        data
      });

      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/${this.spreadsheetId}/values:batchUpdate`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: data,
          success: (res) => {
            console.log('批量更新响应:', res);
            resolve(res);
          },
          fail: (err) => {
            console.error('批量更新请求失败:', err);
            reject(err);
          }
        });
      });

      if (response.statusCode !== 200) {
        console.error('批量更新失败:', {
          statusCode: response.statusCode,
          data: response.data
        });
        throw new Error(`批量更新失败: ${response.statusCode}`);
      }

      console.log('批量更新成功:', response.data);
      return true;

    } catch (err) {
      console.error('批量更新失败:', err);
      throw err;
    }
  }

  /**
   * 更新用户表
   */
  async updateUserTable() {
    try {
      // 1. 获取当前用户信息
      const wechatId = wx.getStorageSync('wechatId');
      const openid = wx.getStorageSync('openid');
      
      if (!wechatId || !openid) {
        console.log('缺少用户信息，无需更新User表');
        return {
          success: true,
          totalUsers: 0,
          newUsers: 0,
          message: '缺少用户信息'
        };
      }

      // 2. 读取现有用户数据
      const userRange = `${this.SHEETS.USER}!A2:C`;
      const existingData = await this.readSheet(userRange);
      
      // 3. 创建用户映射
      const existingUsers = new Map();
      if (existingData) {
        existingData.forEach(row => {
          if (row[0]) {
            existingUsers.set(row[0], {
              wechatId: row[0],
              pinyinName: row[1] || '',
              openId: row[2] || ''
            });
          }
        });
      }

      // 4. 检查当前用户是否需要更新
      const currentUser = existingUsers.get(wechatId);
      if (currentUser) {
        if (currentUser.openId !== openid) {
          // 需要更新 OpenID
          const userIndex = existingData.findIndex(row => row[0] === wechatId);
          if (userIndex !== -1) {
            const updateRange = `${this.SHEETS.USER}!C${userIndex + 2}`;
            await this.writeSheet(updateRange, [[openid]]);
            console.log('已更新用户OpenID');
          }
        }
      } else {
        // 添加新用户
        const newRow = [
          wechatId,
          '',  // pinyinName
          openid
        ];
        const insertRange = `${this.SHEETS.USER}!A${(existingData?.length || 0) + 2}`;
        await this.writeSheet(insertRange, [newRow]);
        console.log('已添加新用户');
      }

      return {
        success: true,
        totalUsers: existingUsers.size,
        newUsers: currentUser ? 0 : 1,
        updatedAt: new Date().toISOString()
      };

    } catch (err) {
      console.error('更新User表失败:', err);
      throw err;
    }
  }

  /**
   * 测试User表更新
   */
  async testUpdateUserTable() {
    try {
      // 1. 测试连接
      await this.testConnection();
      console.log('连接测试成功');

      // 2. 更新User表
      const result = await this.updateUserTable();
      console.log('更新结果:', result);

      return result;
    } catch (err) {
      console.error('测试失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户数据（优先从缓存获取）
   */
  async getUsers() {
    try {
      // 1. 检查缓存是否存在且未过期
      const now = Date.now();
      if (this.cache.users && this.cache.lastUpdate && 
          (now - this.cache.lastUpdate < this.CACHE_CONFIG.USERS.EXPIRE_TIME)) {
        console.log('从缓存获取用户数据');
        return this.cache.users;
      }

      // 2. 从本地存储检查
      const cachedData = wx.getStorageSync(this.CACHE_CONFIG.USERS.KEY);
      if (cachedData && cachedData.timestamp && 
          (now - cachedData.timestamp < this.CACHE_CONFIG.USERS.EXPIRE_TIME)) {
        console.log('从本地存储获取用户数据');
        this.cache.users = cachedData.data;
        this.cache.lastUpdate = cachedData.timestamp;
        return cachedData.data;
      }

      // 3. 从服务器获取新数据
      console.log('从服务器获取用户数据');
      const userRange = `${this.SHEETS.USER}!A2:D`;  // 包含余额列
      const userData = await this.readSheet(userRange);
      
      if (!userData) return [];

      // 4. 处理数据
      const users = userData.map(row => ({
        wechatId: row[0] || '',
        pinyinName: row[1] || '',
        openid: row[2] || '',
        balance: parseFloat(row[3] || 0).toFixed(2)
      })).filter(user => user.wechatId);  // 过滤掉无效数据

      // 5. 更新缓存
      this.cache.users = users;
      this.cache.lastUpdate = now;

      // 6. 保存到本地存储
      wx.setStorageSync(this.CACHE_CONFIG.USERS.KEY, {
        data: users,
        timestamp: now
      });

      return users;
    } catch (err) {
      console.error('获取用户数据失败:', err);
      // 如果有缓存数据，在出错时返回缓存
      if (this.cache.users) {
        return this.cache.users;
      }
      throw err;
    }
  }

  /**
   * 搜索匹配用户（使用缓存）
   */
  async searchUsers(keyword) {
    try {
      // 1. 获取所有用户数据（优先使用缓存）
      const users = await this.getUsers();
      
      // 2. 在本地进行搜索
      const matchedUsers = users.filter(user => 
        user.wechatId.toLowerCase().includes(keyword.toLowerCase())
      );

      console.log('搜索结果:', {
        关键词: keyword,
        匹配数量: matchedUsers.length,
        示例: matchedUsers[0]
      });

      return matchedUsers;
    } catch (err) {
      console.error('搜索用户失败:', err);
      throw err;
    }
  }

  /**
   * 清除用户数据缓存
   */
  clearUsersCache() {
    this.cache.users = null;
    this.cache.lastUpdate = null;
    wx.removeStorageSync(this.CACHE_CONFIG.USERS.KEY);
  }

  /**
   * 强制刷新用户数据
   */
  async refreshUsers() {
    this.clearUsersCache();
    return await this.getUsers();
  }

  /**
   * 更新用户的 OpenID
   * @param {string} wechatId 用户微信ID
   * @param {string} openid 用户OpenID
   */
  async updateUserOpenId(wechatId, openid) {
    try {
      // 1. 从缓存获取用户数据
      const users = await this.getUsers();
      
      // 2. 查找用户索引
      const userIndex = users.findIndex(user => user.wechatId === wechatId);
      if (userIndex === -1) {
        throw new Error('用户不存在');
      }

      // 3. 更新 OpenID
      const updateRange = `${this.SHEETS.USER}!C${userIndex + 2}`;  // +2 是因为跳过表头
      await this.writeSheet(updateRange, [[openid]]);

      // 4. 更新缓存
      users[userIndex].openid = openid;
      this.cache.users = users;
      wx.setStorageSync(this.CACHE_CONFIG.USERS.KEY, {
        data: users,
        timestamp: Date.now()
      });

      console.log('OpenID更新成功:', {
        wechatId,
        openid,
        updateRange
      });

      return true;
    } catch (err) {
      console.error('更新用户OpenID失败:', err);
      throw err;
    }
  }

  /**
   * 创建新用户
   * @param {Object} userData 用户数据
   * @param {string} userData.wechatId 微信ID
   * @param {string} userData.openid OpenID
   */
  async createNewUser(userData) {
    try {
      // 1. 获取现有用户数据
      const users = await this.getUsers();
      
      // 2. 检查是否已存在
      if (users.some(user => user.wechatId === userData.wechatId)) {
        throw new Error('用户已存在');
      }

      // 3. 添加新用户
      const newRow = [
        userData.wechatId,
        '',  // pinyinName
        userData.openid,
        '0.00'  // 初始余额
      ];

      const insertRange = `${this.SHEETS.USER}!A${users.length + 2}`;  // +2 是因为跳过表头
      await this.writeSheet(insertRange, [newRow]);

      // 4. 更新缓存
      const newUser = {
        wechatId: userData.wechatId,
        pinyinName: '',
        openid: userData.openid,
        balance: '0.00'
      };
      
      users.push(newUser);
      this.cache.users = users;
      wx.setStorageSync(this.CACHE_CONFIG.USERS.KEY, {
        data: users,
        timestamp: Date.now()
      });

      console.log('新用户创建成功:', {
        userData,
        insertRange
      });

      return true;
    } catch (err) {
      console.error('创建新用户失败:', err);
      throw err;
    }
  }

  /**
   * 查找用户所在行号
   * @param {string} wechatId 用户微信ID
   * @returns {Promise<number|null>} 行号（从1开始）或null
   */
  async findUserRow(wechatId) {
    try {
      // 1. 从缓存获取用户数据
      const users = await this.getUsers();
      
      // 2. 查找用户索引
      const userIndex = users.findIndex(user => user.wechatId === wechatId);
      
      // 3. 返回行号（索引+2，因为要跳过表头）
      return userIndex > -1 ? userIndex + 2 : null;
    } catch (err) {
      console.error('查找用户行号失败:', err);
      throw err;
    }
  }

  /**
   * 加载用户的所有交易记录
   * @param {string} wechatId 用户微信ID
   */
  async loadUserTransactions(wechatId) {
    try {
      // 1. 获取用户在Record表中的行号
      const userRow = await this.findUserRow(wechatId);
      if (!userRow) {
        throw new Error('找不到用户记录');
      }

      // 2. 获取活动日期行（第2行）
      const dateRange = `${this.SHEETS.RECORD}!${this.SHEET_CONFIG.RECORD.TRANSACTIONS_START}2:${this.SHEET_CONFIG.RECORD.TRANSACTIONS_END}2`;
      const dateRow = await this.readSheet(dateRange);
      if (!dateRow || !dateRow[0]) {
        throw new Error('无法读取日期行');
      }

      // 3. 获取用户的活动记录行
      const activityRange = `${this.SHEETS.RECORD}!${this.SHEET_CONFIG.RECORD.TRANSACTIONS_START}${userRow}:${this.SHEET_CONFIG.RECORD.TRANSACTIONS_END}${userRow}`;
      const activityRow = await this.readSheet(activityRange);
      
      // 4. 获取用户的充值记录
      const depositRange = `${this.SHEETS.DEPOSIT}!A2:D`;
      const depositData = await this.readSheet(depositRange);

      // 5. 处理活动记录
      const activities = [];
      if (activityRow && activityRow[0]) {
        activityRow[0].forEach((value, index) => {
          if (value) {
            const date = dateRow[0][index];
            if (date) {
              // 判断是否为报名序号（整数且小于100）
              const amount = parseFloat(value);
              if (!Number.isInteger(amount) || amount >= 100 || amount <= 0) {
                const formattedDate = this.formatDate(date);
                if (formattedDate) {
                  activities.push({
                    type: 'expense',
                    date: formattedDate,
                    amount: Math.abs(amount).toFixed(2),
                    displayTitle: `${formattedDate} - 消费`
                  });
                }
              }
            }
          }
        });
      }

      // 6. 处理充值记录
      const deposits = [];
      if (depositData) {
        depositData.forEach(row => {
          if (row[1] === wechatId && row[0]) {  // 确保有日期和匹配的微信ID
            const formattedDate = this.formatDate(row[0]);
            if (formattedDate) {
              deposits.push({
                type: 'deposit',
                date: formattedDate,
                amount: parseFloat(row[2] || 0).toFixed(2),
                displayTitle: `充值 - ${row[3] === 'Cash' ? '现金充值' : '电子转账'}`
              });
            }
          }
        });
      }

      // 7. 合并并按日期排序
      const allTransactions = [...activities, ...deposits].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      console.log('交易记录统计:', {
        总记录: allTransactions.length,
        活动记录: activities.length,
        充值记录: deposits.length,
        示例记录: allTransactions[0]
      });

      return allTransactions;

    } catch (err) {
      console.error('加载用户交易记录失败:', err);
      throw err;
    }
  }
}

// 创建单例实例
const sheetsAPI = new SheetsAPI();

// 导出实例
module.exports = {
  sheetsAPI
}; 