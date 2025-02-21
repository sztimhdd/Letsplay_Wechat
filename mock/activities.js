// 活动数据
const activities = [
  {
    id: 1,
    title: "篮球友谊赛",
    date: "2025-01-20",
    startTime: "19:00",
    endTime: "21:00",
    location: "星光篮球场",
    maxMembers: 10,
    currentMembers: 6,
    price: 30,
    totalPrice: 180,
    description: "每周例行篮球友谊赛，欢迎大家参加！",
    organizer: "张教练",
    status: "completed",
    coverImage: "../../assets/images/covers/basketball.webp",
    participants: [
      {
        id: 1,
        name: "张三",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: true
      },
      {
        id: 2,
        name: "李四",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: false
      },
      {
        id: 3,
        name: "王五",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: true
      },
      {
        id: 4,
        name: "赵六",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: false
      },
      {
        id: 5,
        name: "小明",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: true
      },
      {
        id: 6,
        name: "小红",
        avatar: "../../assets/images/avatars/default.png",
        checkedIn: false
      }
    ]
  },
  {
    id: 2,
    title: '春节足球赛',
    date: '2024/02/10',  // 已结束且已报名的活动
    startTime: '15:00',
    endTime: '17:00',
    location: '阳光足球场',
    currentMembers: 10,
    maxMembers: 10,
    totalPrice: 200,
    price: 20,
    organizer: '李四',
    description: '春节特别活动，场地费AA制，欢迎参加！',
    isFull: true,
    coverImage: '/assets/images/covers/football.webp',
    participants: [
      { id: 1, name: '张三', avatar: '/assets/images/avatars/default.png' },
      { id: 2, name: '李四', avatar: '/assets/images/avatars/default.png' },
      { id: 3, name: '我', avatar: '/assets/images/avatars/default.png' }
    ],
    status: 'completed',
    statusText: '已结束'
  },
  {
    id: 3,
    title: '今晚羽毛球活动',
    date: '2025/02/14',  // 今天晚上的活动
    startTime: '20:00',
    endTime: '22:00',
    location: '动力羽毛球馆',
    currentMembers: 6,
    maxMembers: 8,
    totalPrice: 120,
    price: 20,
    organizer: '王五',
    description: '双打活动，场地费AA制，需要自备球拍！',
    isFull: false,
    coverImage: '/assets/images/covers/badminton.webp',
    participants: [
      { id: 1, name: '王五', avatar: '/assets/images/avatars/default.png' },
      { id: 2, name: '我', avatar: '/assets/images/avatars/default.png' }
    ],
    status: 'upcoming',
    statusText: '即将开始'
  },
  {
    id: 4,
    title: '明日篮球赛',
    date: '2025/02/15',  // 明天下午的活动
    startTime: '14:00',
    endTime: '16:00',
    location: '星光体育馆 B区',
    currentMembers: 6,
    maxMembers: 10,
    totalPrice: 150,
    price: 25,
    organizer: '赵六',
    description: '新场地体验活动，场地费AA制，欢迎新手！',
    isFull: false,
    coverImage: '/assets/images/covers/basketball.webp',
    participants: [
      { id: 1, name: '赵六', avatar: '/assets/images/avatars/default.png' },
      { id: 2, name: '钱七', avatar: '/assets/images/avatars/default.png' }
    ],
    status: 'upcoming',
    statusText: '即将开始'
  }
];

module.exports = {
  activities
}; 