function canCheckIn(activity) {
  var now = new Date();
  var start = new Date(activity.date.replace(/-/g, '/') + ' ' + activity.startTime);
  var diffMinutes = (start - now) / 1000 / 60;
  return diffMinutes <= 30 && diffMinutes >= -30;
}

function formatBalance(balance) {
  return balance.toFixed(2);
}

var STATUS_MAP = {
  upcoming: '即将开始',
  ongoing: '进行中',
  completed: '已结束'
};

var STATUS_CLASS = {
  upcoming: 'primary',
  ongoing: 'success',
  completed: 'default'
};

module.exports = {
  canCheckIn: canCheckIn,
  formatBalance: formatBalance,
  STATUS_MAP: STATUS_MAP,
  STATUS_CLASS: STATUS_CLASS
}; 