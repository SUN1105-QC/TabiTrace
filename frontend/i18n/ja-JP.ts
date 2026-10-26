import type { Messages } from './index'

/** 日本語。構造は zh-CN（基準言語）と型で照合される。 */
export const jaJP: Messages = {
  common: {
    save: '保存', saving: '保存中…', saveChanges: '変更を保存', cancel: 'キャンセル', retry: '再試行', reload: '再読み込み', close: '閉じる',
    remove: '削除', removing: '削除中…', on: 'オン', off: 'オフ', loading: '読み込み中…', tryLater: 'しばらくしてからもう一度お試しください', networkError: 'ネットワークエラー',
    operationFailed: '操作に失敗しました。もう一度お試しください', notOpenYet: '準備中', collapse: '閉じる', travelerFallback: '旅するあなた', meFallback: '旅する私'
  },
  errors: {
    title: '問題が発生しました', body: 'ネットワークが不安定か、サービスが一時的に利用できません。データは失われていません。', retry: '再試行', home: 'ホームへ戻る',
    notFoundTitle: 'ページが見つかりません', notFoundBody: 'リンクの有効期限が切れたか、ページが移動した可能性があります。'
  },
  nav: {
    home: 'ホーム', myTrips: 'マイ旅行', createTrip: '旅行を作成', mapCheckin: 'マップとチェックイン', photos: '写真とお気に入り', travelStory: 'Travel Story',
    explore: 'おすすめ探索', memories: '旅の思い出', achievements: '実績', settings: '個人設定', upgradePro: 'Trip Pro にアップグレード',
    upgradeProSub: 'もっと多くの機能を', taglineTop: '旅は、', taglineBottom: 'いつの出発にも意味をくれる。', mainNav: 'メインナビゲーション', secondaryNav: 'サブナビゲーション',
    newContent: '新着あり', closeNav: 'ナビゲーションを閉じる', openNav: 'ナビゲーションを開く', artwork: '旅のイラスト', brandHome: '旅迹 TabiTrace ホーム'
  },
  header: {
    workspace: 'TABITRACE · TRAVEL MEMORY WORKSPACE', searchPlaceholder: '場所・予定・写真・旅行を検索…', searchLabel: '場所・予定・写真・旅行を検索',
    quickCheckin: 'クイックチェックイン', profile: 'プロフィール', accountSettings: 'アカウント設定', logout: 'ログアウト', hello: '{greeting}、{name}さん'
  },
  mobileNav: { label: 'モバイルナビゲーション', home: 'ホーム', trips: '旅程', checkin: 'チェックイン', checkinLabel: 'クイックチェックイン', share: '共有', me: 'マイページ' },
  titles: {
    home: 'ホーム', trips: 'マイ旅行', newTrip: '旅行を作成', map: '旅行マップとチェックイン', photos: '写真とお気に入り', achievements: '旅の実績', summary: '旅のまとめ',
    share: '共有する', story: 'Travel Story', exploreTokyo: '東京公式ガイド', explore: '公式都市ガイド', memories: '旅の思い出', pricing: 'Trip Pro',
    settings: '個人設定', fallback: '旅迹 TabiTrace'
  },
  tripNav: {
    label: '旅行ページ', overview: '概要', map: 'マップとチェックイン', mapShort: 'マップ', photos: '写真', achievements: '実績', summary: 'まとめ',
    share: '共有する', shareShort: '共有', video: 'Travel Story', videoShort: '動画'
  },
  publicNav: {
    explore: '探索', features: '機能', tokyo: '東京セレクト', pro: 'Trip Pro', login: 'ログイン', start: '旅を始める', myTrips: 'マイ旅行',
    enterApp: '旅迹を開く', openMenu: 'メニューを開く', closeMenu: 'メニューを閉じる'
  },
  footer: {
    tagline: '世界中の旅を記録し、場所・写真・物語を、いつでも見返せる作品として残します。', nav: 'フッターナビゲーション',
    product: 'プロダクト', features: '機能', outcomes: '旅の成果', explore: '探索', officialExplore: '公式ガイド', tokyo: '東京セレクト',
    account: 'アカウント', register: '無料で登録', login: 'ログイン', about: '概要', privacySoon: 'プライバシーポリシー（近日公開）', termsSoon: '利用規約（近日公開）', credits: '画像の出典とライセンス'
  },
  notify: {
    button: '通知', buttonUnread: '通知、未読 {count} 件', list: '通知一覧', title: '通知', count: '{count} 件',
    empty: 'まだ旅の更新はありません。チェックインするとここにお知らせが表示されます。',
    achievementTitle: '実績「{name}」を獲得しました', achievementBody: '記録を続けてさらに実績を獲得しましょう',
    storyDoneTitle: 'Travel Story が完成しました', storyDoneBody: '{template} テンプレート · 写真 {photos} 枚',
    storyFailTitle: 'Travel Story の生成に失敗しました', storyFailBody: 'Travel Story ページで再生成できます',
    shareTitle: '共有リンクが {count} 回閲覧されました', shareBody: 'あなたの旅の物語が見られています',
    tripSoonTitle: '「{title}」がまもなく始まります', tripSoonBody: '出発日 {date}',
    tripEndTitle: '「{title}」が終わりました', tripEndBody: '完了にして旅の成果を作りましょう',
    limitPlaceTitle: '無料のチェックイン枠が残りわずかです', limitPlaceBody: '{count} か所を記録済み（上限 10）',
    limitPhotoTitle: '無料の写真枠が残りわずかです', limitPhotoBody: '写真 {count} 枚を保存済み（上限 10）'
  },
  settings: {
    eyebrow: 'PERSONAL SETTINGS', title: '個人設定', subtitle: 'プロフィール、旅の設定、プライバシー、通知を管理します。', loading: '個人設定を読み込み中',
    loadFailed: '個人設定を読み込めませんでした', tabsLabel: '設定カテゴリ', saved: '設定を保存しました', saveFailed: '設定を保存できませんでした。もう一度お試しください', fixFields: '表示された項目を先に修正してください',
    tabs: { profile: 'プロフィール', preferences: '旅の設定', privacy: 'プライバシーと共有', notifications: '通知', security: 'アカウントとセキュリティ', pro: 'Trip Pro' },
    unsaved: {
      region: '未保存の変更', title: '保存していない変更があります', count: '{count} 件', failed: '設定を保存できませんでした。もう一度お試しください。', discard: '変更を取り消す',
      leaveTitle: '保存していない変更があります', leaveBody: '移動する前に変更を保存しますか？破棄すると、最後に保存した内容に戻ります。', leaveDiscard: '変更を破棄'
    },
    summary: {
      label: 'アカウント概要', proTrips: 'TRIP PRO · {count} 件の旅行', trips: '旅行', places: '記録した場所', photos: '写真', joined: '{year}年{month}月に登録',
      openProfile: 'プロフィールを見る', openPro: 'Trip Pro を管理'
    },
    profile: {
      title: 'プロフィール', description: '共有ページで表示される名前と、旅迹でのあなたの見え方です。',
      avatar: 'アバター', avatarDesc: '上部のナビゲーションとアカウント概要に表示されます。',
      nickname: 'ニックネーム', nicknameDesc: '共有ページには「ニックネーム さんの旅迹」と表示されます。',
      bio: '自己紹介', bioDesc: 'あなたの旅のスタイルをひとこと。空欄でも構いません。', bioPlaceholder: '例：のんびり歩いて、街ごとにおいしいコーヒー店を探すのが好き。',
      email: 'ログインメールアドレス', emailDesc: 'ログインメールアドレスの変更には本人確認が必要なため、現在オンラインでは変更できません。',
      nicknameRequired: 'ニックネームを入力してください', nicknameTooLong: 'ニックネームは {max} 文字以内で入力してください', bioTooLong: '自己紹介は {max} 文字以内で入力してください'
    },
    avatar: {
      upload: 'アバターをアップロード', change: 'アバターを変更', uploading: 'アップロード中…', hint: 'JPG・PNG・WebP。自動で正方形に切り抜かれます。', updated: 'アバターを更新しました', removed: 'アバターを削除しました',
      badType: 'JPG・PNG・WebP の画像を選んでください', tooLarge: '画像が大きすぎます。15MB 以内の画像を選んでください', uploadFailed: 'アバターをアップロードできませんでした。もう一度お試しください', removeFailed: '削除できませんでした。もう一度お試しください',
      unsupported: 'このブラウザでは画像を処理できません', processFailed: '画像の処理に失敗しました'
    },
    prefs: {
      title: '旅の設定', description: '旅迹が旅をどのように整理・表示するかを決めます。',
      language: '表示言語', languageDesc: 'ナビゲーション、ページタイトル、個人設定、通知、日付の表示はすぐに切り替わります。その他のページは翻訳中のため中国語で表示される場合があります。あなたが書いた旅のタイトルやメモは翻訳されません。',
      timezone: 'タイムゾーン', timezoneDesc: 'このタイムゾーンでチェックインや写真を「現地のどの日」に振り分け、チェックイン時刻も表示します。',
      distance: '距離の単位', distanceDesc: 'マップとおすすめ探索で表示する距離の単位です。', km: 'キロメートル（km）', mi: 'マイル（mi）', deviceZone: '{zone}（この端末）',
      invalidTimezone: 'タイムゾーンが正しくありません'
    },
    zones: {
      'Asia/Tokyo': '東京 · 日本', 'Asia/Shanghai': '北京 / 上海 · 中国', 'Asia/Hong_Kong': '香港', 'Asia/Taipei': '台北', 'Asia/Seoul': 'ソウル · 韓国',
      'Asia/Singapore': 'シンガポール', 'Asia/Bangkok': 'バンコク · タイ', 'Europe/London': 'ロンドン · イギリス', 'Europe/Paris': 'パリ · フランス',
      'America/New_York': 'ニューヨーク · 米国東部', 'America/Los_Angeles': 'ロサンゼルス · 米国西部', 'Australia/Sydney': 'シドニー · オーストラリア', UTC: '協定世界時（UTC）'
    },
    privacy: {
      title: 'プライバシーと共有', description: '共有リンクから他の人が見られる内容を決めます。',
      visibility: '新しい旅行の既定の公開範囲', visibilityDesc: '新しい旅行はあなただけが見られます。「共有する」でリンクを作成すると「リンクを知っている人（UNLISTED）」になり、すべてのリンクを取り消すと自分のみに戻ります。旅迹には公開プロフィールページはありません。',
      privateOnly: '自分のみ · PRIVATE',
      exact: '共有ページで正確な位置を表示', exactDesc: 'オフにすると、共有ページのチェックイン座標は約 1km の精度になります。ルートの形は見えますが、宿泊先などの具体的な場所は分かりません。',
      expiry: '共有リンクの既定の有効期限', expiryDesc: '新しく作成する共有リンクに自動で設定されます。作成済みのリンクには影響しません。',
      expiryForever: '無期限', expiry7: '7 日後に失効', expiry30: '30 日後に失効'
    },
    notifications: {
      inApp: 'アプリ内通知', inAppDesc: '上部のベルの通知センターに表示する内容です。切り替えるとすぐに保存されます。', updated: '通知設定を更新しました',
      trip: '旅行のリマインダー', tripDesc: '旅行が始まる前や、終わったのにまだ整理していないときにお知らせします。',
      story: 'Travel Story', storyDesc: '旅の動画の生成が完了したとき、または失敗したときにお知らせします。',
      achievement: '旅の実績', achievementDesc: '新しい実績を獲得したときにお知らせします。',
      share: '共有の動き', shareDesc: '共有リンクが開かれたときにお知らせします。',
      quotaNote: '無料枠が残りわずかになったお知らせは常に表示され、旅の途中で突然チェックインや写真のアップロードができなくなることを防ぎます。',
      email: 'メール通知', emailRow: 'メールでのお知らせ', emailDesc: '旅迹はまだ旅に関するお知らせメールを送っていません（登録用の確認コードなどアカウントのセキュリティに関するメールは除く）。提供を開始したらここにスイッチを表示します。',
      emailOff: '準備中'
    },
    security: {
      loginMethod: 'ログイン方法', loginEmail: 'ログインメールアドレス', loginEmailDesc: '旅迹は「メールアドレス + パスワード」でログインします。外部アカウントでのログインにはまだ対応していません。',
      password: 'パスワード', passwordDesc: '変更すると、この端末以外の端末では再ログインが必要になります。', changePassword: 'パスワードを変更',
      passwordUpdated: 'パスワードを更新しました', passwordUpdatedOthers: 'パスワードを更新し、他の {count} 台の端末からログアウトしました',
      devices: 'ログイン中の端末', devicesDesc: 'ログアウトした端末は最大 15 分以内にアクセスできなくなります。', signOutOthers: '他の端末からログアウト（{count}）',
      devicesFailed: 'ログイン中の端末を読み込めませんでした：{error}', devicesLoading: 'ログイン中の端末を読み込み中', currentDevice: 'この端末',
      deviceTimes: 'ログイン {signedIn} · 最終利用 {active}', signOut: 'ログアウト', signingOut: 'ログアウト中…', signOutDevice: '{device} からログアウト（ログイン {time}）',
      showAllDevices: '全 {count} 台の端末を表示', signedOutDevice: '{device} からログアウトしました', signedOutOthers: '他の {count} 台の端末からログアウトしました',
      logoutTitle: 'ログアウト', logoutRow: 'このアカウントからログアウト', logoutDesc: 'この端末だけがログアウトし、他の端末はログインしたままです。', loggingOut: 'ログアウト中…',
      confirmOthersTitle: '他の端末からログアウトしますか？', confirmOthersBody: 'この端末以外の {count} 台の端末がログアウトし、再度パスワードでのログインが必要になります。',
      confirmLogoutTitle: 'ログアウトしますか？', confirmLogoutBody: '旅の記録を続けるには、もう一度ログインが必要です。',
      currentPassword: '現在のパスワード', newPassword: '新しいパスワード（{min} 文字以上）', againPassword: '新しいパスワード（確認）', updatePassword: 'パスワードを更新',
      needCurrent: '現在のパスワードを入力してください', tooShort: '新しいパスワードは {min} 文字以上にしてください', sameAsCurrent: '新しいパスワードは現在のものと別にしてください', mismatch: '新しいパスワードが一致しません',
      changeFailed: 'パスワードを変更できませんでした。もう一度お試しください',
      danger: '危険な操作', deleteAccount: 'アカウントを削除',
      deleteDesc: '削除を申請すると 7 日間の猶予期間に入ります。すべての端末からログアウトし、共有リンクは一時停止されます。期間中に再ログインすれば取り消せます。7 日後に旅行・チェックイン・写真・Travel Story・共有リンク・音楽・アカウントが完全に削除されます。',
      deleteButton: 'アカウントを削除', deleteTitle: 'アカウントを削除しますか？',
      deleteBody: '削除を申請すると：',
      deleteItem1: 'すべての端末からログアウトし、共有リンクは一時停止されます',
      deleteItem2: '{days} 日以内にこのメールアドレスで再ログインすると取り消せます',
      deleteItem3: '猶予期間が過ぎると、旅行・チェックイン・写真・Travel Story・共有リンク・マイミュージック・Trip Pro と会員特典が完全に削除され、元に戻せません',
      deleteItem4: '決済記録は会計記録として保存されますが、アカウントとの紐付けは解除されます',
      deletePassword: '確認のためパスワードを入力', deleteAck: '内容を理解し、削除に同意します',
      deleteSubmit: '削除する', deleting: '削除中…', deleteNeedPassword: 'パスワードを入力してください', deleteNeedAck: '確認のチェックを入れてください'
    },
    pro: {
      description: '旅行ごとの買い切り（1 件 {price}）。アップグレードした旅行はずっと Pro のまま。サブスクリプションや自動更新はありません。', compare: 'プランを比較',
      hasPro: '{count} 件の旅行を Pro にアップグレード済みです。', allFree: 'すべての旅行が無料プランです。', activeFree: '進行中の無料旅行 {active} / {limit}（アーカイブした旅行は含みません）',
      empty: 'まだ旅行がありません。最初の旅行を作成すると、ここから Trip Pro にアップグレードできます。', paid: '{date} にアップグレード · 支払額 {amount}', upgraded: 'アップグレード済み', mock: 'テスト決済',
      upgradeTrip: 'この旅行をアップグレード', upgradeLabel: '「{title}」を Trip Pro にアップグレード',
      lifetimeOwned: '買い切り（生涯 Pro）が有効です。アカウントの現在と今後のすべての旅行が Pro になります。', lifetimeOffer: 'よく旅行しますか？ 生涯 Pro（{price}）を買い切ると、今後の旅行はすべて自動で Pro になります。', lifetimeBuy: '買い切りを見る',
      status: { PLANNING: '計画中', ONGOING: '進行中', COMPLETED: '完了', ARCHIVED: 'アーカイブ済み' }
    }
  }
}
