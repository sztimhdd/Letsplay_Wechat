const activities = [
  {
    id: 1,
    title: '2023年篮球友谊赛',
    date: '2023-12-20',  // 去年的活动
    startTime: '14:00',
    endTime: '16:00',
    location: '星光体育馆 A区',
    currentMembers: 8,
    maxMembers: 10,
    totalPrice: 100,
    price: 13,  // 100/8
    organizer: '张三',
    description: '2023年最后一场友谊赛，场地费AA制，新手友好！',
    isFull: false,
    coverImage: '../../assets/images/covers/basketball.png',
    participants: [
      { id: 1, name: '张三', avatar: '../../assets/images/avatars/default.png' },
      { id: 2, name: '李四', avatar: '../../assets/images/avatars/default.png' }
    ],
    status: 'completed'  // 已结束
  },
  {
    id: 2,
    title: '2023年足球赛',
    date: '2023-12-25',  // 去年的活动
    startTime: '15:00',
    endTime: '17:00',
    location: '阳光足球场',
    currentMembers: 10,
    maxMembers: 10,
    totalPrice: 200,
    price: 20,  // 200/10
    organizer: '李四',
    description: '圣诞节特别活动，场地费AA制，欢迎参加！',
    isFull: true,
    coverImage: '../../assets/images/covers/football.png',
    participants: [
      { id: 1, name: '张三', avatar: '../../assets/images/avatars/default.png' },
      { id: 2, name: '李四', avatar: '../../assets/images/avatars/default.png' },
      { id: 3, name: '我', avatar: '../../assets/images/avatars/default.png', hasCheckedIn: true }
    ],
    status: 'completed'  // 已结束
  },
  {
    id: 3,
    title: '今日羽毛球活动',
    date: new Date().toISOString().split('T')[0],  // 今天
    startTime: '09:00',
    endTime: '11:00',
    location: '动力羽毛球馆',
    currentMembers: 6,
    maxMembers: 8,
    totalPrice: 120,
    price: 20,  // 120/6
    organizer: '王五',
    description: '双打活动，场地费AA制，需要自备球拍！',
    isFull: false,
    coverImage: '../../assets/images/covers/badminton.png',
    participants: [
      { id: 1, name: '王五', avatar: '../../assets/images/avatars/default.png' },
      { id: 2, name: '我', avatar: '../../assets/images/avatars/default.png', hasCheckedIn: false }
    ],
    status: 'ongoing'  // 进行中
  },
  {
    id: 4,
    title: '明日篮球赛',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],  // 明天
    startTime: '14:00',
    endTime: '16:00',
    location: '星光体育馆 B区',
    currentMembers: 6,
    maxMembers: 10,
    totalPrice: 150,
    price: 25,  // 150/6
    organizer: '赵六',
    description: '新场地体验活动，场地费AA制，欢迎新手！',
    isFull: false,
    coverImage: '../../assets/images/covers/basketball.png',
    participants: [
      { id: 1, name: '赵六', avatar: '../../assets/images/avatars/default.png' },
      { id: 2, name: '钱七', avatar: '../../assets/images/avatars/default.png' }
    ],
    status: 'upcoming'  // 即将开始
  }
];

module.exports = {
  activities
}; 