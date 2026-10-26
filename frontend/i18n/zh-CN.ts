/**
 * 简体中文（基准语言）。其他语言文件的结构由这里的类型约束：缺少任何一个键都会在 TypeScript 检查时报错。
 * 键名规则：模块.小驼峰（例如 nav.myTrips、settings.profile.nickname）；插值用 {name}。
 * 只翻译产品界面；旅行标题、打卡文字、简介等用户内容永远原样显示。
 */
export const zhCN = {
  common: {
    save: '保存', saving: '保存中…', saveChanges: '保存更改', cancel: '取消', retry: '重试', reload: '重新加载', close: '关闭',
    remove: '移除', removing: '移除中…', on: '开', off: '关', loading: '正在加载…', tryLater: '请稍后再试', networkError: '网络异常',
    operationFailed: '操作失败，请重试', notOpenYet: '暂未开放', collapse: '收起', travelerFallback: '旅行中的你', meFallback: '旅行中的我'
  },
  errors: {
    title: '页面出了点问题', body: '可能是网络不稳定或服务暂时不可用，你的数据不会因此丢失。', retry: '重试', home: '返回首页',
    notFoundTitle: '找不到这个页面', notFoundBody: '链接可能已经失效，或者页面已被移动。'
  },
  nav: {
    home: '首页', myTrips: '我的旅行', createTrip: '创建旅行', mapCheckin: '地图与打卡', photos: '照片与精选', travelStory: 'Travel Story',
    explore: '推荐探索', memories: '旅行回忆', achievements: '我的成就', settings: '个人设置', upgradePro: '升级 Trip Pro',
    upgradeProSub: '解锁更多精彩功能', taglineTop: '旅行，', taglineBottom: '让每一次出发都有意义。', mainNav: '主导航', secondaryNav: '次级导航',
    newContent: '有新内容', closeNav: '关闭导航', openNav: '打开导航', artwork: '旅行插画', brandHome: '旅迹 TabiTrace 首页'
  },
  header: {
    workspace: 'TABITRACE · TRAVEL MEMORY WORKSPACE', searchPlaceholder: '搜索地点、行程、照片或旅行…', searchLabel: '搜索地点、行程、照片或旅行',
    quickCheckin: '快速打卡', profile: '个人主页', accountSettings: '账户设置', logout: '退出登录', hello: '{greeting}，{name}'
  },
  mobileNav: { label: '移动端导航', home: '首页', trips: '旅程', checkin: '打卡', checkinLabel: '快速打卡', share: '分享', me: '我的' },
  titles: {
    home: '首页', trips: '我的旅行', newTrip: '创建旅行', map: '旅行地图与打卡', photos: '照片与精选', achievements: '旅行成就', summary: '旅行总结',
    share: '分享成果', story: 'Travel Story', exploreTokyo: '东京官方探索', explore: '官方城市探索', memories: '旅行回忆', pricing: 'Trip Pro',
    settings: '个人设置', fallback: '旅迹 TabiTrace'
  },
  tripNav: {
    label: '旅行页面', overview: '总览', map: '地图与打卡', mapShort: '地图', photos: '照片', achievements: '成就', summary: '总结',
    share: '分享成果', shareShort: '分享', video: '旅行视频', videoShort: '视频'
  },
  publicNav: {
    explore: '探索', features: '功能', tokyo: '东京精选', pro: 'Trip Pro', login: '登录', start: '开始旅行', myTrips: '我的旅行',
    enterApp: '进入旅迹', openMenu: '打开菜单', closeMenu: '关闭菜单'
  },
  footer: {
    tagline: '记录全球旅行，收藏地点、照片与故事，让每一次出发都留下可以回看的作品。', nav: '页脚导航',
    product: '产品', features: '功能', outcomes: '旅行成果', explore: '探索', officialExplore: '官方探索', tokyo: '东京精选',
    account: '账户', register: '免费注册', login: '登录', about: '关于', privacySoon: '隐私政策（即将发布）', termsSoon: '服务条款（即将发布）', credits: '图片来源与授权'
  },
  notify: {
    button: '通知', buttonUnread: '通知，{count} 条未读', list: '通知列表', title: '通知', count: '{count} 条',
    empty: '还没有新的旅行动态。完成一次打卡后，这里会出现提醒。',
    achievementTitle: '解锁成就「{name}」', achievementBody: '继续记录可以解锁更多成就',
    storyDoneTitle: 'Travel Story 生成完成', storyDoneBody: '{template} 模板 · {photos} 张照片',
    storyFailTitle: 'Travel Story 生成失败', storyFailBody: '可以在旅行视频页重新生成',
    shareTitle: '分享链接被访问 {count} 次', shareBody: '有人看过你的旅行故事',
    tripSoonTitle: '「{title}」即将开始', tripSoonBody: '出发日期 {date}',
    tripEndTitle: '「{title}」已经结束', tripEndBody: '可以标记完成并生成旅行成果',
    limitPlaceTitle: '免费打卡额度接近上限', limitPlaceBody: '已记录 {count} 个地点，上限 10 个',
    limitPhotoTitle: '免费照片额度接近上限', limitPhotoBody: '已保存 {count} 张照片，上限 10 张'
  },
  settings: {
    eyebrow: 'PERSONAL SETTINGS', title: '个人设置', subtitle: '管理你的账户资料、旅行偏好、隐私和通知方式。', loading: '正在加载个人设置',
    loadFailed: '个人设置加载失败', tabsLabel: '设置分类', saved: '设置已保存', saveFailed: '设置保存失败，请重试', fixFields: '请先修改标出的字段',
    tabs: { profile: '个人资料', preferences: '旅行偏好', privacy: '隐私与分享', notifications: '通知', security: '账户与安全', pro: 'Trip Pro' },
    unsaved: {
      region: '未保存的更改', title: '有尚未保存的更改', count: '{count} 项', failed: '设置保存失败，请重试。', discard: '取消更改',
      leaveTitle: '有尚未保存的更改', leaveBody: '离开前要保存这些更改吗？放弃后，修改将恢复为上次保存的内容。', leaveDiscard: '放弃更改'
    },
    summary: {
      label: '账户概览', proTrips: 'TRIP PRO · {count} 段旅行', trips: '旅行', places: '记录地点', photos: '照片', joined: '{year} 年 {month} 月加入',
      openProfile: '查看个人资料', openPro: '管理 Trip Pro'
    },
    profile: {
      title: '个人资料', description: '别人在你的分享页上看到的名字，以及你在旅迹里的样子。',
      avatar: '头像', avatarDesc: '显示在顶部导航和账户概览中。',
      nickname: '昵称', nicknameDesc: '分享页会显示为“来自 你的昵称 的旅迹分享”。',
      bio: '个人简介', bioDesc: '一句话介绍你的旅行方式，可以留空。', bioPlaceholder: '例如：喜欢慢慢走，在城市里找一家好喝的咖啡店。',
      email: '登录邮箱', emailDesc: '修改登录邮箱需要通过账户安全验证，目前暂不支持在线修改。',
      nicknameRequired: '昵称不能为空', nicknameTooLong: '昵称最多 {max} 个字', bioTooLong: '个人简介最多 {max} 个字'
    },
    avatar: {
      upload: '上传头像', change: '更换头像', uploading: '上传中…', hint: 'JPG、PNG 或 WebP，会自动裁成正方形。', updated: '头像已更新', removed: '已移除头像',
      badType: '请选择 JPG、PNG 或 WebP 图片', tooLarge: '图片太大，请选择 15MB 以内的图片', uploadFailed: '头像上传失败，请重试', removeFailed: '移除失败，请重试',
      unsupported: '浏览器不支持图片处理', processFailed: '图片处理失败'
    },
    prefs: {
      title: '旅行偏好', description: '影响旅迹如何整理和显示你的旅行。',
      language: '界面语言', languageDesc: '导航、页面标题、个人设置、通知和日期格式会立即切换；其他页面的中文内容正在逐步翻译。你写的旅行标题、打卡文字等内容不会被翻译。',
      timezone: '时区', timezoneDesc: '按这个时区把打卡和照片归到“当地的哪一天”，并以这个时区显示打卡时间。',
      distance: '距离单位', distanceDesc: '地图与推荐探索里显示的距离。', km: '公里 km', mi: '英里 mi', deviceZone: '{zone}（当前设备）',
      invalidTimezone: '时区无效'
    },
    zones: {
      'Asia/Tokyo': '东京 · 日本', 'Asia/Shanghai': '北京 / 上海 · 中国', 'Asia/Hong_Kong': '香港', 'Asia/Taipei': '台北', 'Asia/Seoul': '首尔 · 韩国',
      'Asia/Singapore': '新加坡', 'Asia/Bangkok': '曼谷 · 泰国', 'Europe/London': '伦敦 · 英国', 'Europe/Paris': '巴黎 · 法国',
      'America/New_York': '纽约 · 美国东部', 'America/Los_Angeles': '洛杉矶 · 美国西部', 'Australia/Sydney': '悉尼 · 澳大利亚', UTC: 'UTC 协调世界时'
    },
    privacy: {
      title: '隐私与分享', description: '决定别人通过分享链接能看到什么。',
      visibility: '新旅行默认可见性', visibilityDesc: '新建的旅行只有你能看到。在“分享成果”里创建链接后变为“通过链接访问（UNLISTED）”；撤销全部链接后恢复为仅自己。旅迹暂不提供公开主页。',
      privateOnly: '仅自己 · PRIVATE',
      exact: '分享页显示精确位置', exactDesc: '关闭时，分享页里的打卡坐标只保留约 1 公里精度：路线轮廓仍然可见，但不会暴露住处等具体位置。',
      expiry: '分享链接默认有效期', expiryDesc: '新建分享链接时自动设置到期时间，已经创建的链接不受影响。',
      expiryForever: '长期有效', expiry7: '7 天后失效', expiry30: '30 天后失效'
    },
    notifications: {
      inApp: '站内通知', inAppDesc: '显示在顶部铃铛通知中心里的内容，切换后立即保存。', updated: '通知设置已更新',
      trip: '旅行提醒', tripDesc: '旅行即将开始、或已经结束但还没整理时提醒你。',
      story: 'Travel Story', storyDesc: '旅行视频生成完成或生成失败时通知你。',
      achievement: '旅行成就', achievementDesc: '解锁新的旅行成就时通知你。',
      share: '分享动态', shareDesc: '你的分享链接被别人打开时通知你。',
      quotaNote: '免费额度快用完的提醒会一直显示，避免你在旅途中突然无法打卡或上传照片。',
      email: '邮件通知', emailRow: '邮件提醒', emailDesc: '旅迹目前还没有开通通知邮件，不会向你的邮箱发送任何旅行通知（注册验证码等账户安全邮件除外）。开通后会在这里提供开关。',
      emailOff: '暂未开通'
    },
    security: {
      loginMethod: '登录方式', loginEmail: '登录邮箱', loginEmailDesc: '旅迹使用“邮箱 + 密码”登录，暂未接入第三方账号登录。',
      password: '密码', passwordDesc: '修改后，除当前设备外的其他设备需要重新登录。', changePassword: '修改密码',
      passwordUpdated: '密码已更新', passwordUpdatedOthers: '密码已更新，已退出其他 {count} 台设备',
      devices: '已登录设备', devicesDesc: '退出后，那台设备最长会在 15 分钟内失去访问权限。', signOutOthers: '退出其他设备（{count}）',
      devicesFailed: '已登录设备加载失败：{error}', devicesLoading: '正在加载已登录设备', currentDevice: '当前设备',
      deviceTimes: '登录于 {signedIn} · 最近活动 {active}', signOut: '退出', signingOut: '退出中…', signOutDevice: '退出 {device}（登录于 {time}）',
      showAllDevices: '显示全部 {count} 台设备', signedOutDevice: '已退出 {device}', signedOutOthers: '已退出其他 {count} 台设备',
      logoutTitle: '退出登录', logoutRow: '退出当前账户', logoutDesc: '只退出这台设备，其他设备保持登录。', loggingOut: '正在退出…',
      confirmOthersTitle: '退出其他设备？', confirmOthersBody: '将退出除当前设备外的 {count} 台设备，它们需要重新输入密码登录。',
      confirmLogoutTitle: '退出当前账户？', confirmLogoutBody: '退出后需要重新登录才能继续记录旅行。',
      currentPassword: '当前密码', newPassword: '新密码（至少 {min} 位）', againPassword: '再次输入新密码', updatePassword: '更新密码',
      needCurrent: '请输入当前密码', tooShort: '新密码至少 {min} 位', sameAsCurrent: '新密码不能与当前密码相同', mismatch: '两次输入的新密码不一致',
      changeFailed: '密码修改失败，请重试',
      danger: '危险操作', deleteAccount: '删除账户',
      deleteDesc: '注销后有 7 天冷静期：期间所有设备立即退出、分享链接暂停访问，重新登录可以撤销。7 天后旅行、打卡、照片、Travel Story、分享链接、音乐和账号会被永久删除。',
      deleteButton: '注销账户', deleteTitle: '确定注销账户吗？',
      deleteBody: '注销后会发生：',
      deleteItem1: '所有设备立即退出登录，分享链接暂停访问',
      deleteItem2: '{days} 天冷静期内，用这个邮箱重新登录即可撤销注销',
      deleteItem3: '冷静期结束后，旅行、打卡、照片、Travel Story、分享链接、我的音乐、Trip Pro 与会员权益会被永久删除，无法恢复',
      deleteItem4: '付款记录作为财务凭证会保留，但不再与你的账号关联',
      deletePassword: '输入登录密码确认', deleteAck: '我已了解上述内容，确认注销',
      deleteSubmit: '确认注销', deleting: '正在注销…', deleteNeedPassword: '请输入登录密码', deleteNeedAck: '请先勾选确认'
    },
    pro: {
      description: '按单段旅行一次性购买（{price} / 段），升级后这段旅行永久保持 Pro；也可以买断终身 Pro。没有订阅和自动续费。', compare: '查看方案对比',
      hasPro: '已有 {count} 段旅行升级为 Pro。', allFree: '目前所有旅行都是免费版。', activeFree: '进行中的免费旅行 {active} / {limit}（归档后不计入）',
      empty: '还没有旅行。创建第一段旅行后，可以在这里为它升级 Trip Pro。', paid: '{date} 升级 · 实付 {amount}', upgraded: '已升级', mock: '模拟支付',
      upgradeTrip: '升级这段旅行', upgradeLabel: '升级「{title}」为 Trip Pro',
      lifetimeOwned: '已买断终身 Pro：账号下现有和以后新建的所有旅行都是 Pro。', lifetimeOffer: '经常旅行？买断终身 Pro（{price}），以后每段旅行都自动解锁。', lifetimeBuy: '了解买断',
      status: { PLANNING: '计划中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' }
    }
  }
} as const
