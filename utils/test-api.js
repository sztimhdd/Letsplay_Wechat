/**
 * API测试模块
 * 提供API连接测试功能
 */

// API测试对象
const apiTest = {
  /**
   * 延迟测试函数
   * @param {number} delay - 延迟时间（毫秒）
   * @returns {Promise<boolean>} - 测试结果
   */
  async delayedTest(delay = 1000) {
    console.log(`开始API延迟测试，延迟时间: ${delay}ms`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // 这里可以添加实际的API测试逻辑
        // 目前简单返回成功
        console.log('API测试完成，连接正常');
        resolve(true);
      }, delay);
    });
  },
  
  /**
   * 测试API连接
   * @returns {Promise<boolean>} - 测试结果
   */
  async testConnection() {
    try {
      console.log('测试API连接...');
      // 这里可以添加实际的API连接测试逻辑
      // 目前简单返回成功
      return true;
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }
};

// 导出API测试对象
export { apiTest }; 