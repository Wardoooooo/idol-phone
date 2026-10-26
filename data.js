/* =========================================================
   Content data — edit everything here
   ========================================================= */
var DATA = {

  /* ---------- Phone owner ---------- */
  owner: {
    name: 'Min',
    en: 'MIN',
    avatar: 'assets/avatar.jpg',
    sub: 'Singer · Main vocal',
    bio: 'Sunsets, tteokbokki and your messages.\n\n"You worked hard today."'
  },

  theme: { accent: '#7c5cff', accent2: '#ff5c8a' },

  /* ---------- Lock screen ---------- */
  lock: {
    pin: '0309',                   // 4-digit passcode (changeable in Settings)
    wallpaper: 'assets/wallpaper_ios4.jpg',
    notifications: [
      { icon: '💬', app: 'Messages', title: 'You', text: 'You worked hard today', time: 'now', chat: 'you' }
    ]
  },

  wallpaper: 'assets/wallpaper_ios4.jpg',

  weather: {
    city: 'Seoul', temp: '18°', desc: 'Sunny', icon: '☀️',
    forecast: [
      { day: 'Thu', icon: '☀️', hi: '19°', lo: '11°' },
      { day: 'Fri', icon: '⛅', hi: '17°', lo: '10°' },
      { day: 'Sat', icon: '🌧', hi: '15°', lo: '9°' },
      { day: 'Sun', icon: '⛅', hi: '16°', lo: '9°' },
      { day: 'Mon', icon: '☀️', hi: '18°', lo: '10°' }
    ]
  },

  alarms: [
    { time: '07:30', label: 'Wake up', on: true },
    { time: '12:00', label: 'Lunch', on: false },
    { time: '22:30', label: 'Practice ends', on: true }
  ],

  /* ---------- Contacts ---------- */
  contacts: {
    you:     { name: 'You',     avatar: 'assets/avatar2.jpg', status: 'Online' },
    mom:     { name: 'Mom',     avatar: 'assets/avatar3.jpg', status: 'Online' },
    manager: { name: 'Manager', avatar: 'assets/avatar.jpg',  status: 'Busy' }
  },

  /* ---------- Chats ----------
     t: 'date' | 'me' | 'them'; voice: '0:03' + src
  ----------------------------- */
  chats: {
    you: [
      { t: 'date', text: 'Oct 18' },
      { t: 'them', text: 'Practice just finished' },
      { t: 'me',   text: 'Good work!' },
      { t: 'them', text: 'haha what are you doing' },
      { t: 'me',   text: 'Waiting for your message' },
      { t: 'them', text: 'Really?' },
      { t: 'them', voice: '0:03', src: 'assets/voice_1.wav' },
      { t: 'me',   text: '! Your voice is so nice' },
      { t: 'them', text: "I'll send you one tomorrow" },
      { t: 'date', text: 'Today' },
      { t: 'them', text: 'I just saw the sunset' },
      { t: 'them', text: 'It made me think of you' },
      { t: 'me',   text: 'Me too' }
    ],
    mom: [
      { t: 'date', text: 'Yesterday' },
      { t: 'them', text: 'Did you eat?' },
      { t: 'me',   text: "Yes, don't worry" },
      { t: 'them', text: 'Sleep early' }
    ],
    manager: [
      { t: 'date', text: 'Yesterday' },
      { t: 'them', text: 'Meet at the company at 9 tomorrow' },
      { t: 'me',   text: 'Got it' }
    ]
  },

  unread: { you: 2, mom: 0, manager: 0 },

  /* Auto-replies after you send a message */
  liveScript: {
    you: [
      "I'm here",
      'Thank you for today',
      'By the way, are you free on Nov 21?',
      'I want to see you',
      'Good night, sweet dreams'
    ]
  },

  /* ---------- Incoming call (after N sent messages) ---------- */
  call: {
    contact: 'you',
    name: 'Min',
    avatar: 'assets/avatar.jpg',
    afterMessages: 3
  },

  /* ---------- Photos ---------- */
  photos: [
    {
      month: 'October 2026',
      items: [
        { src: 'assets/photo_01.jpg', cap: 'Practice room mirror' },
        { src: 'assets/photo_02.jpg', cap: 'Han River at dawn' },
        { src: 'assets/photo_03.jpg', cap: 'Dinner' },
        { src: 'assets/photo_04.jpg', cap: 'Flowers from a fan' },
        { src: 'assets/photo_05.jpg', cap: 'Recording studio' },
        { src: 'assets/photo_06.jpg', cap: 'Your back, secretly' }
      ]
    },
    {
      month: 'September 2026',
      items: [
        { src: 'assets/photo_07.jpg', cap: 'Rainy day' },
        { src: 'assets/photo_08.jpg', cap: 'A cat on the street' },
        { src: 'assets/photo_09.jpg', cap: 'The day we first met' }
      ]
    }
  ],

  /* ---------- Music ---------- */
  songs: [
    { title: 'Off My Face', artist: 'Min', cover: 'assets/cover_1.jpg', src: 'assets/song_1.wav' },
    { title: 'Good',        artist: 'Min', cover: 'assets/cover_2.jpg', src: 'assets/song_2.wav' },
    { title: 'Sunset',      artist: 'Min', cover: 'assets/cover_3.jpg', src: 'assets/song_3.wav' }
  ],

  /* ---------- Notes ---------- */
  notes: [
    { title: 'Practice', date: '2026-10-16',
      body: 'Mon/Wed/Fri · Art Hall 312\nTue/Thu · afternoon practice\n\nOn show days we finish late\nWalk down toward the student union' },
    { title: 'Things you like', date: '2026-10-15',
      body: 'Tteokbokki, cream bread\nYou can eat spicy food\nSweet drinks\n\nNot a fan of Changnyeong tteokbokki\n\nDrink something warm when your throat hurts' },
    { title: 'To do', date: '2026-10-05',
      body: 'Nov 21\nWatch the sunset with you\nSing this song for you\n\n"You worked hard today."' }
  ],

  /* ---------- Calendar (YYYY-MM-DD) ---------- */
  events: [
    { date: '2026-10-21', time: '19:00', title: 'Practice', place: 'Art Hall 312' },
    { date: '2026-10-23', time: '14:00', title: 'Recording', place: 'Studio B1' },
    { date: '2026-10-26', time: '18:30', title: 'Promise with you', place: 'The usual place' },
    { date: '2026-10-31', time: '20:00', title: 'Halloween live', place: 'Company' },
    { date: '2026-11-21', time: '17:30', title: 'Birthday', place: 'Han River Park' }
  ],

  /* ---------- Mail ---------- */
  mails: [
    { from: 'Planning Team', subject: 'November schedule', date: 'Yesterday', unread: true,
      body: 'Hi Min,\n\nThe November schedule is attached.\nYou have the 21st off.\n\nPlanning Team' },
    { from: 'Music Bank', subject: 'Rehearsal this week', date: '10/15', unread: true,
      body: 'Rehearsal is at 3 PM this Thursday.\nPlease arrive an hour early.\n\nMusic Bank' },
    { from: 'You', subject: '(No subject)', date: '10/12',
      body: "The sunset was beautiful today.\nLet's watch the next one together." }
  ],

  /* ---------- Call history ---------- */
  calls: [
    { contact: 'you', type: 'in',   time: 'Today 9:04 PM', dur: '12:31', seen: true },
    { contact: 'mom', type: 'out',  time: 'Yesterday 7:22 PM', dur: '03:08', seen: true },
    { contact: 'manager', type: 'missed', time: 'Yesterday 9:15 AM', dur: '', seen: false }
  ],

  /* ---------- Social ---------- */
  social: {
    instagram: {
      name: 'MIN',
      handle: '@min.official',
      avatar: 'assets/avatar.jpg',
      bio: 'singer · sometimes photographer',
      posts: 42,
      followers: '1.2M',
      following: 128,
      photos: [
        'assets/photo_01.jpg', 'assets/photo_02.jpg', 'assets/photo_03.jpg',
        'assets/photo_04.jpg', 'assets/photo_05.jpg', 'assets/photo_06.jpg',
        'assets/photo_07.jpg', 'assets/photo_08.jpg', 'assets/photo_09.jpg'
      ]
    },
    twitter: {
      name: 'MIN',
      handle: '@min_official',
      avatar: 'assets/avatar.jpg',
      tweets: [
        { text: 'Practice room, 2AM. One more time.', time: '2h',
          replies: '482', retweets: '3.4K', likes: '18.2K' },
        { text: 'The sunset today was unreal. Wish you were here.', time: '5h',
          replies: '1.1K', retweets: '7.8K', likes: '42.1K' },
        { text: 'New song coming soon. 🎧', time: '1d',
          replies: '2.3K', retweets: '12K', likes: '96K' },
        { text: 'Thank you for today. Really.', time: '2d',
          replies: '903', retweets: '4.1K', likes: '28.7K' }
      ]
    },
    facebook: {
      name: 'MIN',
      handle: 'MIN Official',
      avatar: 'assets/avatar.jpg',
      cover: 'assets/wallpaper.jpg',
      posts: [
        { text: 'Thank you for all the birthday messages. I read every one of them.', time: 'Yesterday', likes: '24K' },
        { text: "Behind the scenes from today's shoot. It was colder than it looks.", time: '3d', likes: '12K' },
        { text: 'See you at the fan meeting next month.', time: '1w', likes: '31K' }
      ]
    }
  }
};
