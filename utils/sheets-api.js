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
        TRANSACTIONS_END: 'HH',   // 交易记录结束列
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
      },
      USER: {
        COLUMNS: {
          WECHAT_ID: 'A',    // 微信名称
          PINYIN_NAME: 'B',  // 拼音名称
          OPENID: 'C'        // OpenID
        },
        DATA_START_ROW: 2
      }
    };

    // 扩展缓存配置
    this.CACHE_CONFIG = {
      EXPIRE_TIME: 5 * 60 * 1000,  // 5分钟过期
      KEYS: {
        SHEET_DATA: 'cached_sheet_data',
        USERS: 'cached_users',
        ACTIVITIES: 'cached_activities',
        DEPOSITS: 'cached_deposits'
      }
    };

    // 全局数据缓存
    this.cache = {
      lastUpdate: null,
      sheetData: null,
      users: null,
      activities: null,
      deposits: null
    };
  }

  /**
   * 一次性加载所有表格数据
   */
  async loadAllSheetData() {
    try {
      console.log('开始加载所有表格数据...');

      // 检查缓存是否有效
      if (this.isValidCache()) {
        console.log('使用缓存数据');
        return this.cache.sheetData;
      }

      // 2. 定义所有需要读取的范围
      const ranges = [
        // Users表
        `${this.SHEETS.USER}!A${this.SHEET_CONFIG.USER.DATA_START_ROW}:C`,
        // Record表（包括固定列和交易记录）
        `${this.SHEETS.RECORD}!A${this.SHEET_CONFIG.RECORD.DATA_START_ROW}:${this.SHEET_CONFIG.RECORD.TRANSACTIONS_END}`,
        // Deposit表
        `${this.SHEETS.DEPOSIT}!A${this.SHEET_CONFIG.DEPOSIT.DATA_START_ROW}:D`
      ];

      // 3. 并行读取所有数据
      console.log('开始读取表格数据:', ranges);
      const [usersData, recordData, depositData] = await Promise.all(
        ranges.map(range => this.readSheet(range))
      );

      // 4. 处理和组织数据
      const sheetData = {
        users: this.processUsersData(usersData),
        record: this.processRecordData(recordData),
        deposits: this.processDepositsData(depositData)
      };

      // 5. 更新缓存
      this.updateCache(sheetData);

      console.log('所有数据加载完成');
      return sheetData;
    } catch (err) {
      console.error('加载表格数据失败:', err);
      throw err;
    }
  }

  /**
   * 处理用户数据
   */
  processUsersData(usersData) {
    if (!usersData) return [];
    return usersData
      .filter(row => row[0])
      .map(row => ({
        wechatId: row[0],
        pinyinName: row[1] || '',
        openid: row[2] || '',
        balance: '0.00'  // 初始化余额，后续会更新
      }));
  }

  /**
   * 处理Record表数据
   */
  processRecordData(recordData) {
    if (!recordData) return { balances: {}, activities: [] };
    
    const balances = {};
    const activities = [];

    try {
      // 1. 处理用户余额数据（前5列固定数据）
      recordData.forEach((row, index) => {
        if (index >= 5 && row[1]) {  // 从第6行开始是用户数据，B列是微信号
          balances[row[1]] = row[3] || '0.00';  // D列是余额
        }
      });

      // 2. 处理活动数据（从F列开始）
      const FIXED_COLUMNS = 5; // A-E列是固定列
      
      // 获取活动基本信息行
      const dateRow = recordData[0] || [];      // 第2行：活动日期 (M/DD/YYYY)
      const venueRow = recordData[1] || [];     // 第3行：场地信息 (X号场 - XX人)
      const timeRow = recordData[2] || [];      // 第4行：时间段 (HH:mm-HH:mm)
      const feeRow = recordData[3] || [];       // 第5行：总费用
      const participantRows = recordData.slice(5); // 从第6行开始是参与者数据

      

      // 从F列开始处理每个活动
      for (let colIndex = FIXED_COLUMNS; colIndex < dateRow.length; colIndex++) {
        // 1. 处理日期
        const rawDate = dateRow[colIndex];
        if (!rawDate || rawDate.toLowerCase() === 'cancelled') {
          continue;
        }

        // 标准化日期格式
        let date;
        try {
          // 处理两种可能的格式：M/DD/YYYY 或 YYYY-MM-DD
          let year, month, day;
          
          // 尝试匹配 M/DD/YYYY 格式
          const slashMatch = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (slashMatch) {
            [, month, day, year] = slashMatch;
          } else {
            // 尝试匹配 YYYY-MM-DD 格式
            const dashMatch = rawDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (dashMatch) {
              [, year, month, day] = dashMatch;
            } else {
              console.warn(`无法解析日期格式: ${rawDate}`);
              continue;
            }
          }
          
          // 标准化为 YYYY-MM-DD 格式
          date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        } catch (err) {
          console.error('日期处理错误:', err);
          continue;
        }

        // 2. 解析场地信息
        const rawVenue = venueRow[colIndex] || '';
        let venue = rawVenue, maxParticipants = 16; // 默认16人

        // 尝试解析标准格式 "X号场 - XX人"
        const venueMatch = rawVenue.match(/(\d+)号场\s*-\s*(\d+)人/);
        if (venueMatch) {
          const [, fieldNumber, capacity] = venueMatch;
          venue = `${fieldNumber}号场`;
          maxParticipants = parseInt(capacity) || 16;
        } else {
          // 尝试解析只有场地号的格式
          const numberMatch = rawVenue.match(/^(\d+)$/);
          if (numberMatch) {
            venue = `${numberMatch[1]}号场`;
          }
          // 如果都无法解析，直接使用原始字符串
        }

        // 3. 解析时间段
        const rawTimeSlot = timeRow[colIndex] || '';
        if (!rawTimeSlot) {
          continue;
        }

        // 分割并处理时间段
        const timeParts = rawTimeSlot.split(/[-~]/);
        if (timeParts.length !== 2) {
          console.warn(`无效的时间段格式: ${rawTimeSlot}`);
          continue;
        }

        // 处理开始和结束时间
        const startTime = this.formatTime(timeParts[0]);
        const endTime = this.formatTime(timeParts[1]);

        if (!startTime || !endTime) {
          console.warn(`无法解析时间段: ${rawTimeSlot}`);
          continue;
        }

        const timeSlot = `${startTime}-${endTime}`;

        // 4. 获取总费用
        const totalFee = parseFloat(feeRow[colIndex] || 0);

        // 5. 处理参与者
        const participants = participantRows
          .map((row, rowIndex) => {
            const fee = parseFloat(row[colIndex] || 0);
            if (fee <= 0) return null;
            
            return {
              name: row[0] || '',        // A列：姓名
              wechatId: row[1] || '',    // B列：微信号
              fee: fee.toFixed(2),
              signUpIndex: rowIndex + 1
            };
          })
          .filter(Boolean);

        // 创建活动对象
        activities.push({
          id: `activity_${colIndex}`,
          date,                          // 标准化的日期 YYYY-MM-DD
          displayDate: this.formatDisplayDate(date), // 显示用的日期格式
          venue,                         // 场地信息（原始字符串或解析后的格式）
          timeSlot,                      // 标准化的时间段 (HH:mm-HH:mm)
          totalFee: totalFee.toFixed(2),
          maxParticipants,              // 默认16人或解析出的人数
          currentParticipants: participants.length,
          perPersonFee: participants.length > 0 ? 
            (totalFee / participants.length).toFixed(2) : '0.00',
          participants,
          status: this.getActivityStatus(date, timeSlot),
          columnIndex: colIndex,
          rawVenue,                      // 保存原始场地信息
          displayTimeSlot: rawTimeSlot,  // 原始时间段
        });
      }

      console.log('处理后的活动数据:', {
        总数: activities.length,
        示例: activities[0]
      });

      return { balances, activities };
    } catch (err) {
      console.error('处理Record表数据失败:', err);
      return { balances: {}, activities: [] };
    }
  }

  /**
   * 处理时间段格式
   * @param {string} rawTime - 原始时间字符串
   * @returns {string} 标准化的24小时制时间 (HH:mm)
   */
  formatTime(rawTime) {
    if (!rawTime) return '';
    
    // 移除所有空格
    rawTime = rawTime.replace(/\s+/g, '');
    
    // 1. 处理4位数格式 "1030" -> "22:30"
    if (/^\d{4}$/.test(rawTime)) {
      const hours = parseInt(rawTime.slice(0, 2));
      const minutes = rawTime.slice(2);
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    // 2. 处理1-2位数格式 "9" -> "21:00"
    if (/^\d{1,2}$/.test(rawTime)) {
      const hours = parseInt(rawTime);
      return `${(hours + 12).toString().padStart(2, '0')}:00`;
    }
    
    // 3. 如果已经是标准格式 "22:30"，直接返回
    if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
      return rawTime.padStart(5, '0');
    }
    
    return rawTime;
  }

  /**
   * 格式化显示用的日期
   */
  formatDisplayDate(isoDate) {
    try {
      if (!isoDate) return '';

      // 确保日期格式为 YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        console.warn('日期格式不正确:', isoDate);
        return isoDate;
      }

      const [year, month, day] = isoDate.split('-').map(Number);
      
      // 创建日期对象（使用 UTC 来避免时区问题）
      const date = new Date(Date.UTC(year, month - 1, day));
      
      if (isNaN(date.getTime())) {
        console.warn('无效的日期:', isoDate);
        return isoDate;
      }

      return `${month}月${day}日`;
    } catch (err) {
      console.error('日期格式化失败:', err, isoDate);
      return isoDate;
    }
  }

  /**
   * 获取活动状态
   */
  getActivityStatus(date, timeSlot) {
    try {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.warn('无效的日期格式:', date);
        return 'unknown';
      }

      const now = new Date();
      const [year, month, day] = date.split('-').map(Number);
      const activityDate = new Date(Date.UTC(year, month - 1, day));
      
      if (isNaN(activityDate.getTime())) {
        console.warn('无效的日期:', date);
        return 'unknown';
      }

      // 设置为当地时间的0点
      activityDate.setHours(0, 0, 0, 0);
      
      if (timeSlot) {
        const [startTime] = timeSlot.split('-');
        if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
          const [hours, minutes] = startTime.split(':').map(Number);
          activityDate.setHours(hours, minutes);
        }
      }

      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (activityDate < nowDate) {
        return 'completed';
      } else if (activityDate > nowDate) {
        return 'upcoming';
      } else {
        // 同一天，检查具体时间
        if (now < activityDate) {
          return 'upcoming';
        } else if (now > activityDate) {
          return 'completed';
        } else {
          return 'ongoing';
        }
      }
    } catch (err) {
      console.error('活动状态判断失败:', err);
      return 'unknown';
    }
  }

  /**
   * 处理充值记录数据
   */
  processDepositsData(depositData) {
    if (!depositData) return [];
    return depositData
      .filter(row => row[0] && row[1])
      .map(row => ({
        date: row[0],
        wechatId: row[1],
        amount: row[2],
        method: row[3]
      }));
  }

  /**
   * 检查缓存是否有效
   */
  isValidCache() {
    return (
      this.cache.lastUpdate &&
      this.cache.sheetData &&
      Date.now() - this.cache.lastUpdate < this.CACHE_CONFIG.EXPIRE_TIME
    );
  }

  /**
   * 更新缓存
   */
  updateCache(sheetData) {
    this.cache = {
      lastUpdate: Date.now(),
      sheetData,
      users: sheetData.users,
      activities: sheetData.record.activities,
      deposits: sheetData.deposits
    };
    
    // 更新本地存储
    wx.setStorageSync(this.CACHE_CONFIG.KEYS.SHEET_DATA, {
      data: sheetData,
      timestamp: this.cache.lastUpdate
    });
  }

  /**
   * 获取用户数据（使用缓存）
   */
  async getUsers() {
    try {
      const sheetData = await this.loadAllSheetData();
      const users = sheetData.users.map(user => ({
        ...user,
        balance: sheetData.record.balances[user.wechatId] || '0.00'
      }));
      return users;
    } catch (err) {
      console.error('获取用户数据失败:', err);
      throw err;
    }
  }

  /**
   * 加载用户交易记录（使用缓存）
   */
  async loadUserTransactions(wechatId) {
    try {
      const sheetData = await this.loadAllSheetData();
      const transactions = [];

      // 添加活动记录
      if (sheetData.record.activities) {
        transactions.push(...sheetData.record.activities
          .filter(t => t.wechatId === wechatId)
          .map(t => ({
            type: 'expense',
            date: t.date,
            amount: Math.abs(t.amount).toFixed(2),
            displayTitle: t.title || '活动消费'
          })));
      }

      // 添加充值记录
      if (sheetData.deposits) {
        transactions.push(...sheetData.deposits
          .filter(d => d.wechatId === wechatId)
          .map(d => ({
            type: 'deposit',
            date: d.date,
            amount: parseFloat(d.amount || 0).toFixed(2),
            displayTitle: `充值 - ${d.method === 'Cash' ? '现金充值' : '电子转账'}`
          })));
      }

      // 按日期排序
      return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (err) {
      console.error('加载用户交易记录失败:', err);
      throw err;
    }
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
   * 统一的活动数据处理方法
   */
  async getActivities(options = {}) {
    try {
      const {
        wechatId = '',      // 指定用户的活动
        limit = 20,         // 限制返回数量
        includeDetails = false,  // 是否包含详细信息
        status = 'all'      // 活动状态筛选
      } = options;

      // 使用缓存的数据
      const sheetData = await this.loadAllSheetData();
      if (!sheetData?.record?.activities) {
        console.warn('未找到活动数据');
        return [];
      }

      let activities = sheetData.record.activities;

      // 1. 用户筛选
      if (wechatId) {
        activities = activities.filter(activity => {
          const participants = activity.participants || [];
          return participants.some(p => p.wechatId === wechatId);
        });
      }

      // 2. 状态筛选
      if (status !== 'all') {
        const statusFunc = (activity) => {
          const date = activity.date;
          const timeSlot = activity.timeSlot;
          return this.getActivityStatus(date, timeSlot);
        };
        activities = activities.filter(activity => statusFunc(activity) === status);
      }

      // 3. 添加详细信息
      if (includeDetails) {
        activities = activities.map(activity => ({
          ...activity,
          participants: this.processParticipants(activity.participants || []),
          stats: this.calculateActivityStats(activity)
        }));
      }

      // 4. 按日期排序并限制数量
      activities = activities
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

      console.log('处理后的活动数据:', {
        总数: activities.length,
        示例: activities[0]
      });

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
   * 根据 OpenID 查找用户
   */
  async findUserByOpenId(openid) {
    try {
      console.log('开始查找用户, OpenID:', openid);
      const users = await this.getUsers();
      const user = users.find(user => user.openid === openid);
      console.log('查找结果:', user);
      return user || null;
    } catch (err) {
      console.error('查找用户失败:', err);
      throw err;
    }
  }

  /**
   * 处理参与者数据
   */
  processParticipants(participants) {
    if (!Array.isArray(participants)) return [];
    
    return participants.map((participant, index) => ({
      ...participant,
      signUpOrder: index + 1,
      displayName: participant.name || participant.wechatId
    }));
  }

  /**
   * 计算活动统计数据
   */
  calculateActivityStats(activity) {
    const stats = {
      totalParticipants: 0,
      totalFee: 0,
      averageFee: 0,
      isFull: false,
      remainingSlots: 0
    };

    if (!activity) return stats;

    const participants = activity.participants || [];
    stats.totalParticipants = participants.length;
    stats.totalFee = parseFloat(activity.totalFee || 0);
    stats.averageFee = stats.totalParticipants > 0 ? 
      (stats.totalFee / stats.totalParticipants).toFixed(2) : 0;
    stats.isFull = stats.totalParticipants >= (activity.maxParticipants || 16);
    stats.remainingSlots = Math.max(0, 
      (activity.maxParticipants || 16) - stats.totalParticipants);

    return stats;
  }

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.wechatId - 微信名称
   * @param {string} userData.openid - OpenID
   * @returns {Promise<Object>} - 创建的用户数据
   */
  async createNewUser(userData) {
    try {
      if (!userData || !userData.wechatId || !userData.openid) {
        throw new Error('无效的用户数据');
      }

      console.log('开始创建新用户:', userData);

      // 1. 获取Users表的最后一行
      const range = `${this.SHEETS.USER}!A:C`;
      const existingData = await this.readSheet(range);
      const lastRow = existingData ? existingData.length + 1 : 2; // 如果没有数据，从第2行开始

      // 2. 准备新用户数据
      const newUserData = [
        userData.wechatId,           // A列：微信名称
        userData.pinyinName || '',   // B列：拼音名称（可选）
        userData.openid             // C列：OpenID
      ];

      // 3. 写入新用户数据
      const updateRange = `${this.SHEETS.USER}!A${lastRow}:C${lastRow}`;
      await this.writeSheet(updateRange, [newUserData]);

      // 4. 清除缓存，强制重新加载
      this.cache = {
        lastUpdate: null,
        sheetData: null,
        users: null,
        activities: null,
        deposits: null
      };

      // 5. 返回创建的用户数据
      const createdUser = {
        wechatId: userData.wechatId,
        pinyinName: userData.pinyinName || '',
        openid: userData.openid,
        balance: '0.00'
      };

      console.log('新用户创建成功:', createdUser);
      return createdUser;

    } catch (err) {
      console.error('创建新用户失败:', err);
      throw err;
    }
  }

  /**
   * 写入数据到表格
   * @param {string} range - 写入范围
   * @param {Array<Array>} values - 要写入的数据
   */
  async writeSheet(range, values) {
    try {
      if (!this.accessToken) {
        await this.getAccessToken();
      }

      const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
      
      return new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            range: range,
            majorDimension: 'ROWS',
            values: values
          },
          success: (res) => {
            if (res.statusCode === 200) {
              console.log('数据写入成功:', range);
              resolve(res.data);
            } else {
              reject(new Error(`写入失败: ${res.statusCode}`));
            }
          },
          fail: reject
        });
      });
    } catch (err) {
      console.error('写入表格失败:', err);
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