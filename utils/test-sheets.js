import { sheetsAPI } from './sheets-api';

async function testUserActivityDetails() {
  console.log('开始测试用户活动详情...');
  
  try {
    const userDetails = await sheetsAPI.getUserActivityDetails('uo');
    
    // 1. 验证基本信息
    console.log('基本信息:', {
      姓名: userDetails.name,             // 应该是 "Bo Liu"
      微信: userDetails.wechat,           // 应该是 "uo"
      总押金: userDetails.stats.totalDeposit.toFixed(2),    // 应该是 1871.50
      总支出: userDetails.stats.totalSpent.toFixed(2),      // 应该是 1692.99
      当前余额: userDetails.stats.balance.toFixed(2),       // 应该是 178.51
    });

    // 2. 验证活动统计
    console.log('活动统计:', {
      参与次数: userDetails.activities.length,
      首次参与: userDetails.stats.firstActivityDate,
      最近参与: userDetails.stats.lastActivityDate,
      最高费用: userDetails.stats.maxFee.toFixed(2),
      最低费用: userDetails.stats.minFee.toFixed(2),
      平均费用: userDetails.stats.averageFee.toFixed(2)
    });

    // 3. 验证原始费用数据
    console.log('原始费用数据前10个:', userDetails.rawFees.slice(0, 10));
    
    // 4. 验证非零费用记录数
    const nonZeroFees = userDetails.rawFees.filter(fee => parseFloat(fee || 0) > 0);
    console.log('非零费用记录数:', nonZeroFees.length);

    // 5. 验证总支出计算
    const manualTotal = userDetails.rawFees
      .map(fee => parseFloat(fee || 0))
      .reduce((sum, fee) => sum + fee, 0);
    
    console.log('支出验证:', {
      手动计算总额: manualTotal.toFixed(2),
      API计算总额: userDetails.stats.totalSpent.toFixed(2),
      差额: Math.abs(manualTotal - userDetails.stats.totalSpent).toFixed(2),
      是否匹配: Math.abs(manualTotal - userDetails.stats.totalSpent) < 0.01 ? '✅' : '❌'
    });

    // 6. 验证活动记录
    console.log('活动记录示例(前5条):', userDetails.activities.slice(0, 5).map(a => ({
      日期: a.date,
      场地: a.field,
      时间: a.timeSlot,
      总费用: a.totalFee,
      个人费用: a.userFee
    })));

  } catch (err) {
    console.error('测试失败:', err);
  }
}

// 导出测试函数
export {
  testUserActivityDetails
}; 