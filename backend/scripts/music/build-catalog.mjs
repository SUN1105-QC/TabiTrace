// 生成 catalog.json：旅迹背景音乐库的唯一数据源（曲目、来源、授权、分类）。
// 所有字段都来自 2026-09-27 对官方曲目页 / 授权页的核验；不要手写修改 catalog.json，改这里再重新生成。
//   node backend/scripts/music/build-catalog.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')
const CHECKED = '2026-09-27'

const SB = {
  artist: 'Scott Buckley',
  source: 'Scott Buckley Creative Commons Music Library',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  licensePolicyUrl: 'https://www.scottbuckley.com.au/library/licensing/',
  licenseNotes: '作者授权表：免费 CC BY 列允许 Online Multimedia（YouTube / 社交媒体 / 网站）与 Software（games, apps）；不得单独转卖、不得上传发行平台或流媒体。' +
    'YouTube 使用 Smart Content ID：视频描述中没有署名会被自动认领，补上署名后可按作者说明解除（https://www.scottbuckley.com.au/library/faq/）。',
  attribution: title => `'${title}' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au`
}
const KM = {
  artist: 'Kevin MacLeod',
  source: 'incompetech.com',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  licensePolicyUrl: 'https://incompetech.com/music/royalty-free/faq.html',
  licenseNotes: '作者 FAQ：可用于 YouTube（可变现）、流媒体与其他项目，必须署名；允许剪辑、拼接、改编。' +
    '全部曲目已预注册 YouTube Content ID，只识别视频描述中的文字署名（https://incompetech.com/music/royalty-free/youtube-contentid.html）。',
  attribution: title => `"${title}" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`
}

// [code, 作者, 曲名, 官方页 slug / ISRC, 下载地址, 分类, 情绪, 乐器, 官方 BPM, 套餐, Essential, 推荐模板, 官方描述摘要]
const APPROVED = [
  ['SB_WANDERLUST', SB, 'Wanderlust', 'wanderlust', '2020/08/sb_wanderlust.mp3', 'JOURNEY', ['warm', 'happy', 'acoustic'], ['mandolin', 'strings', 'piano', 'percussion'], null, 'FREE', true, 'JOURNAL', 'A folksy, carefree track featuring mandolin, strings, piano and simple percussion.'],
  ['SB_FELICITY', SB, 'Felicity', 'felicity', '2021/03/sb_felicity.mp3', 'JOURNEY', ['happy', 'warm'], ['piano', 'mandolin', 'strings', 'synth', 'drums'], null, 'PRO', false, null, 'A folksy, hopeful pop piano track.'],
  ['SB_CLEAR_SKIES', SB, 'Clear Skies', 'clear-skies', '2024/02/ClearSkies.mp3', 'JOURNEY', ['cinematic', 'happy'], ['orchestra'], null, 'PRO', false, null, 'Uplifting, positive orchestral vibes.'],
  ['KM_COOL_VIBES', KM, 'Cool Vibes', 'USUAN1100863', 'Cool Vibes.mp3', 'CITY', ['urban', 'calm'], ['vibraphone', 'bass', 'drums'], 83, 'FREE', true, null, 'A simple little slow jazz trio.'],
  ['SB_ORIGAMI', SB, 'Origami', 'origami', '2025/10/Origami.mp3', 'CITY', ['urban', 'happy', 'electronic'], ['electric piano', 'synth', 'drums'], null, 'FREE', true, 'CITY', 'Smooth, upbeat electro-jazz.'],
  ['KM_ETERNITY', KM, 'Eternity', 'USUAN1600031', 'Eternity.mp3', 'CITY', ['urban', 'calm'], ['guitar', 'bass', 'drums', 'electric piano', 'synth'], 100, 'PRO', false, null, 'High-class, non-offensive lounge groove.'],
  ['KM_CHILL_WAVE', KM, 'Chill Wave', 'USUAN1600048', 'Chill Wave.mp3', 'CITY', ['urban', 'calm', 'electronic'], ['synth', 'bass', 'drums', 'guitar'], 100, 'PRO', false, null, 'Relaxed, grooving chillwave.'],
  ['SB_ECHOES_OF_HOME', SB, 'Echoes Of Home', 'echoes-of-home', '2025/05/EchoesOfHome.mp3', 'JAPAN', ['warm', 'nostalgic', 'japan'], ['orchestra'], null, 'FREE', true, null, 'A warm, nostalgic orchestral track.'],
  ['KM_SENBAZURU', KM, 'Senbazuru', 'USUAN1100821', 'Senbazuru.mp3', 'JAPAN', ['calm', 'japan'], ['koto', 'synth', 'cello', 'flute'], 48, 'PRO', false, null, 'Warm and calming piece with a Japanese sort of sound.'],
  ['KM_MORNING', KM, 'Morning', 'USUAN2300003', 'Morning.mp3', 'MORNING', ['morning', 'calm', 'acoustic'], ['classical guitar', 'harp', 'flute'], 60, 'FREE', true, 'MINIMAL', 'Bright, calm, relaxed morning piece.'],
  ['KM_WATER_LILY', KM, 'Water Lily', 'USUAN1400035', 'Water Lily.mp3', 'MORNING', ['morning', 'calm', 'piano'], ['piano', 'double bass', 'cello'], 62, 'PRO', false, null, 'Simple and elegant.'],
  ['SB_GLOW', SB, 'Glow', 'glow', '2022/02/Glow.mp3', 'MORNING', ['morning', 'warm', 'acoustic'], ['acoustic guitar', 'piano', 'background vocals'], null, 'PRO', false, null, 'A folksy, simple and heart-warming track.'],
  ['SB_SOLACE', SB, 'Solace', 'solace', '2020/05/sb_solace.mp3', 'MORNING', ['calm', 'morning'], ['strings', 'synth', 'piano', 'glass marimba'], null, 'PRO', false, null, 'Calm, meandering strings and contemplative piano.'],
  ['KM_EVENING', KM, 'Evening', 'USUAN2300002', 'Evening.mp3', 'SUNSET', ['calm', 'warm'], ['guitar', 'cello', 'oboe'], 101, 'FREE', true, null, 'Bright, calm, relaxed evening piece.'],
  ['SB_MOONLIGHT', SB, 'Moonlight', 'moonlight', '2022/07/Moonlight.mp3', 'SUNSET', ['romantic', 'nostalgic', 'piano'], ['piano', 'strings'], null, 'PRO', false, null, 'A simple, nostalgic track for piano and strings.'],
  ['SB_GOLDEN_HOUR', SB, 'Golden Hour', 'golden-hour', '2023/02/GoldenHour.mp3', 'SUNSET', ['warm', 'cinematic'], ['vocals', 'strings', 'synth'], null, 'PRO', false, null, 'A warm, uplifting track featuring vocals, strings and synth.'],
  ['KM_LATE_NIGHT_RADIO', KM, 'Late Night Radio', 'USUAN2100003', 'Late Night Radio.mp3', 'NIGHT', ['night', 'calm', 'lofi'], ['electric piano', 'bass', 'drums', 'synth'], 72, 'FREE', true, null, 'Calm late-night electric piano groove.'],
  ['KM_DREAM_CULTURE', KM, 'Dream Culture', 'USUAN1300046', 'Dream Culture.mp3', 'NIGHT', ['night', 'calm', 'piano'], ['piano', 'percussion'], 70, 'PRO', false, null, 'Dreamy watery piano over tight percussion.'],
  ['SB_PETRICHOR', SB, 'Petrichor', 'petrichor', '2019/05/sb_petrichor.mp3', 'NIGHT', ['night', 'calm', 'electronic'], ['synth', 'piano'], null, 'PRO', false, null, 'Ambient synth pads and soft piano.'],
  ['SB_HOME_WAS_YOU', SB, 'Home Was You', 'home-was-you', '2026/07/HomeWasYou.mp3', 'MEMORY', ['nostalgic', 'warm', 'piano'], ['piano', 'strings', 'accordion', 'percussion'], null, 'FREE', true, null, 'A peaceful, folksy and nostalgic track.'],
  ['SB_AMBERLIGHT', SB, 'Amberlight', 'amberlight', '2025/03/Amberlight.mp3', 'MEMORY', ['nostalgic', 'warm', 'cinematic'], ['piano', 'orchestra'], null, 'FREE', true, null, 'A soft, nostalgic piano and orchestral track.'],
  ['SB_WITH_THESE_HANDS', SB, 'With These Hands', 'with-these-hands', '2026/06/WithTheseHands.mp3', 'MEMORY', ['nostalgic', 'calm'], ['piano', 'strings', 'synth'], null, 'PRO', false, null, 'A dreamy, nostalgic and contemplative track.'],
  ['SB_THE_LONG_WAY_HOME', SB, 'The Long Way Home', 'the-long-way-home', '2021/05/sb_thelongwayhome.mp3', 'MEMORY', ['nostalgic', 'calm', 'piano'], ['piano', 'strings', 'synth'], null, 'PRO', false, null, 'Soft, simple nostalgic piano.'],
  ['KM_PEPPERS_THEME', KM, "Pepper's Theme", 'USUAN1400033', 'Peppers Theme.mp3', 'MEMORY', ['warm', 'calm'], ['piano', 'guitar', 'bass', 'flute'], 76, 'PRO', false, null, 'Interplay between piano and guitar, ending upbeat.'],
  ['SB_WILDFLOWERS', SB, 'Wildflowers', 'wildflowers', '2025/12/Wildflowers.mp3', 'CINEMATIC', ['cinematic', 'nostalgic'], ['piano', 'strings'], null, 'FREE', true, null, 'Piano & strings, starting softly and building.'],
  ['SB_CHASING_DAYLIGHT', SB, 'Chasing Daylight', 'chasing-daylight', '2021/03/sb_chasingdaylight.mp3', 'CINEMATIC', ['cinematic', 'calm'], ['piano', 'strings', 'synth'], null, 'PRO', false, null, 'A contemplative neoclassical journey.'],
  ['SB_SIMPLICITY', SB, 'Simplicity', 'simplicity', '2024/03/Simplicity.mp3', 'PHOTO_DIARY', ['happy', 'warm', 'acoustic'], ['piano', 'fiddle', 'acoustic guitar', 'mandolin', 'drums'], null, 'FREE', true, null, 'A calming, uplifting pop piano track.'],
  ['KM_DREAMER', KM, 'Dreamer', 'USUAN1600043', 'Dreamer.mp3', 'PHOTO_DIARY', ['calm', 'piano'], ['piano', 'percussion'], 100, 'PRO', false, null, 'Rich piano chords with subtle percussion.'],
  ['KM_AUTUMN_DAY', KM, 'Autumn Day', 'USUAN1100765', 'Autumn Day.mp3', 'PHOTO_DIARY', ['warm', 'calm'], ['guitar', 'bass', 'drums', 'strings', 'piano'], 126, 'PRO', false, null, 'A reflective, calm and comforting piece.'],
  ['KM_SUMMER_DAY', KM, 'Summer Day', 'USUAN1200083', 'Summer Day.mp3', 'SLOW', ['slow', 'calm'], ['guitar', 'electric piano', 'bass', 'drums'], 60, 'PRO', false, null, 'Soothing piece with an interesting harmonic left-turn.'],
  ['KM_WINDSWEPT', KM, 'Windswept', 'USUAN1100757', 'Windswept.mp3', 'NATURE', ['nature', 'calm', 'acoustic'], ['guitar', 'strings'], 79, 'FREE', true, null, 'Relaxed guitar and strings for scenic outdoors.'],
  ['SB_CICADAS', SB, 'Cicadas', 'cicadas', '2023/12/Cicadas.mp3', 'NATURE', ['nature', 'calm'], ['piano', 'strings', 'violin', 'field recording'], null, 'PRO', false, null, 'Delicate neoclassical track with recorded cicadas.'],
  ['KM_GEORGE_STREET_SHUFFLE', KM, 'George Street Shuffle', 'USUAN1300035', 'George Street Shuffle.mp3', 'HAPPY', ['happy', 'urban'], ['vibraphone', 'bass', 'piano', 'drums'], 153, 'PRO', false, null, 'Non-offending light jazz piece for vibes.']
]

// 待人工确认（Pixabay）：不下载、不上架，只保留版权核验记录
const REVIEW = [
  ['PX_TOKYO_CAFE', 'TVARI - Tokyo Cafe', 'TVARI', 'https://pixabay.com/music/beats-tvari-tokyo-cafe-159065/', 'CITY', 153],
  ['PX_SCENERY_OF_MEMORIES', 'Scenery of Memories', 'ukaka5656', 'https://pixabay.com/music/modern-classical-scenery-of-memories-195693/', 'MEMORY', 118],
  ['PX_SUNSET_DAWN', 'Sunset Dawn', 'NastelBom', 'https://pixabay.com/music/pop-sunset-dawn-408999/', 'SUNSET', 144],
  ['PX_AMBIENT_CINEMATIC', 'Ambient Cinematic', 'ElectroAnimals', 'https://pixabay.com/music/ambient-ambient-cinematic-588276/', 'CINEMATIC', 193],
  ['PX_WINTER_SUNSET', 'Winter Sunset', '331music', 'https://pixabay.com/music/instrumental-winter-sunset-595462/', 'SUNSET', 141],
  ['PX_THIS_SUNSET', 'This Sunset', 'Universfield', 'https://pixabay.com/music/meditationspiritual-this-sunset-188458/', 'SUNSET', 387],
  ['PX_MORNING_GARDEN', 'Morning Garden - Acoustic Chill', 'folk_acoustic', 'https://pixabay.com/music/acoustic-group-morning-garden-acoustic-chill-15013/', 'MORNING', 233]
]

const tracks = APPROVED.map(([code, a, title, ref, file, category, moods, instruments, bpm, plan, essential, recommendedTemplate, description], i) => ({
  code, title, artist: a.artist, source: a.source,
  sourceUrl: a === SB ? `https://www.scottbuckley.com.au/library/${ref}/` : `https://incompetech.com/music/royalty-free/index.html?isrc=${ref}`,
  downloadUrl: a === SB ? `https://www.scottbuckley.com.au/library/wp-content/uploads/${file}` : `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(file)}`,
  isrc: a === KM ? ref : null,
  license: a.license, licenseUrl: a.licenseUrl, licensePolicyUrl: a.licensePolicyUrl, licenseNotes: a.licenseNotes,
  attributionRequired: true, attributionText: a.attribution(title),
  commercialUse: true, videoUse: true, derivativeAllowed: true, exportAllowed: true,
  standaloneRedistribution: '不提供原曲下载；只作为用户旅行视频的一部分导出',
  socialMediaUse: 'Instagram / TikTok / 小红书等：允许，需署名（片尾 + 发布文案）',
  youtubeUse: '允许（可变现），但必须在视频描述中署名，否则会被 Content ID 自动认领（可解除）',
  saasUse: a === SB ? '作者授权表 CC BY 列允许 Software / apps' : 'CC BY 4.0 允许再分发与改编（需署名）',
  category, moods, instruments, bpm, bpmSource: bpm ? 'official' : null,
  plan, essential, recommendedTemplate, description,
  status: 'APPROVED', licenseCheckedAt: CHECKED, sortOrder: i + 1
}))

const review = REVIEW.map(([code, title, artist, sourceUrl, category, durationSeconds], i) => ({
  code, title, artist, source: 'Pixabay', sourceUrl, downloadUrl: null,
  license: 'Pixabay Content License', licenseUrl: 'https://pixabay.com/service/terms/', licensePolicyUrl: 'https://pixabay.com/service/faq/',
  licenseNotes: '检查时未注册 Content ID，但作者之后仍可注册；条款未说明 SaaS 生成视频与在选择器中试听原曲的情形（可能构成“独立分发”）。需向 info@pixabay.com 书面确认后才能上架。',
  attributionRequired: false, attributionText: `${title} by ${artist} via Pixabay`,
  commercialUse: true, videoUse: true, derivativeAllowed: true, exportAllowed: false,
  category, moods: [], instruments: [], bpm: null, durationSeconds,
  plan: 'PRO', essential: false, recommendedTemplate: null,
  status: 'REVIEW_REQUIRED', licenseCheckedAt: CHECKED, sortOrder: 900 + i
}))

fs.writeFileSync(path.join(here, 'catalog.json'), JSON.stringify({ checkedAt: CHECKED, tracks: [...tracks, ...review] }, null, 2) + '\n')
console.log(`catalog.json: ${tracks.length} APPROVED + ${review.length} REVIEW_REQUIRED`)
