/** 部署平台健康检查：只确认网页服务在运行，不访问数据库或其他服务（API 有自己的 /actuator/health） */
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
