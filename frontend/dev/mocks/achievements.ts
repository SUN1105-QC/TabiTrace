/**
 * 成就定义（与后端 achievements 表的条件类型一致）。
 * 每段旅行的进度、是否解锁都由 Mock 数据层根据打卡 / 照片实时计算，不在这里写死结果，
 * 所以在 Mock 模式下新增打卡、上传照片后成就也会跟着变化。
 */
export type MockAchievementDef = {
  id: number
  code: string
  name: string
  description: string
  type: 'GLOBAL' | 'CITY'
  cityCode?: string
  conditionType: 'CHECKIN_COUNT' | 'PHOTO_COUNT' | 'AREA_COUNT' | 'TRIP_COMPLETED' | 'OFFICIAL_CHECKIN_COUNT' | 'PLACE_SET'
  target: number
  /** conditionType = PLACE_SET 时需要打卡的地点名 */
  places?: string[]
}

export const mockAchievementDefs: MockAchievementDef[] = [
  { id: 1, code: 'FIRST', name: '初次启程', description: '完成第一次打卡', type: 'GLOBAL', conditionType: 'CHECKIN_COUNT', target: 1 },
  { id: 2, code: 'PHOTO_STORY', name: '旅行记录者', description: '在一次旅行中记录 10 张照片', type: 'GLOBAL', conditionType: 'PHOTO_COUNT', target: 10 },
  { id: 3, code: 'EXPLORER', name: '城市探索者', description: '在 5 个不同区域打卡', type: 'GLOBAL', conditionType: 'AREA_COUNT', target: 5 },
  { id: 4, code: 'COLLECTOR', name: '足迹收藏家', description: '累计打卡 20 次', type: 'GLOBAL', conditionType: 'CHECKIN_COUNT', target: 20 },
  { id: 5, code: 'TRIP_COMPLETE', name: '旅程完成', description: '完成一段旅行', type: 'GLOBAL', conditionType: 'TRIP_COMPLETED', target: 1 },
  { id: 6, code: 'TOKYO_START', name: '东京初心者', description: '完成首个东京官方地点', type: 'CITY', cityCode: 'TOKYO', conditionType: 'OFFICIAL_CHECKIN_COUNT', target: 1 },
  { id: 7, code: 'TRADITION', name: '东京传统派', description: '打卡浅草寺与仲见世商店街', type: 'CITY', cityCode: 'TOKYO', conditionType: 'PLACE_SET', target: 2, places: ['浅草寺', '仲见世商店街'] },
  { id: 8, code: 'NIGHT', name: '东京夜行者', description: '打卡三处东京夜景', type: 'CITY', cityCode: 'TOKYO', conditionType: 'PLACE_SET', target: 3, places: ['涩谷十字路口', '东京都厅展望台', '东京塔', '歌舞伎町', '彩虹大桥'] },
  { id: 9, code: 'TOKYO_MASTER', name: '东京达人', description: '完成 20 个东京官方地点', type: 'CITY', cityCode: 'TOKYO', conditionType: 'OFFICIAL_CHECKIN_COUNT', target: 20 }
]

/** 东京官方地点总数（用于探索进度；与本地种子数据的规模一致） */
export const MOCK_TOKYO_OFFICIAL_TOTAL = 30
