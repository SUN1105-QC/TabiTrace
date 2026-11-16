'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { adminModules, type AdminTrip, type AdminMedia, type AuditEntry, type ExtraSection, type Invitation, type MaintenanceJob, type MaintenanceSummary, type RegistrationDefaults, type RuntimeSettings } from '@/services/admin-modules'
import type { AdminPageResult } from '@/services/admin'
import { adminBytes } from '@/utils/admin-users'
import { AdminDialog } from './AdminDialog'
import { AdminPagination } from './AdminUsersTable'
import { InviteUserDialog } from './InviteUserDialog'
import { useAdminResource } from './useAdminResource'
import styles from './admin.module.css'

type ModuleData = {
  invitations?: AdminPageResult<Invitation>; trips?: AdminPageResult<AdminTrip>; media?: AdminPageResult<AdminMedia>; audit?: AdminPageResult<AuditEntry>
  defaults?: RegistrationDefaults; runtime?: RuntimeSettings; maintenance?: MaintenanceSummary; jobs?: MaintenanceJob[]
}
export type ModuleState = { connected: boolean; loading: boolean; updatedAt: number | null }
type Mutation = { title: string; body: string; expected?: string; run: (confirmation: string) => Promise<unknown> }
const date = (value?: string | null) => value ? new Date(value.endsWith('Z') ? value : `${value}Z`).toLocaleString('zh-CN') : '—'
const labels: Record<string,string> = { PENDING: '等待注册', ACCEPTED: '已注册', REVOKED: '已撤销', PLANNING: '计划中', ONGOING: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档', READY: '可用', DRAFT: '草稿', QUEUED: '排队中', PROCESSING: '处理中', RUNNING: '执行中', FAILED: '失败', UPLOADING: '上传中', DELETED: '已删除', PHOTO: '照片', VIDEO: '视频', MUSIC: '用户音乐', TRIPS: '到期旅程', ACCOUNTS: '到期注销账号' }
const label = (value: string) => labels[value] ?? value
const auditLabels: Record<string,string> = { UPDATE_USER:'修改用户权限', REPLY_MESSAGE:'回复留言', INVITE_USER:'发送注册邀请', RESEND_INVITATION:'重发邀请', REVOKE_INVITATION:'撤销邀请', DELETE_USER:'安排删除用户', RESTORE_USER:'撤销用户删除', UPDATE_DEFAULTS:'修改新账号默认权限', TRIP_ARCHIVE:'归档旅程', TRIP_UNARCHIVE:'取消归档', TRIP_REVOKE_SHARES:'撤销旅程分享', TRIP_DELETE:'删除旅程', DELETE_PHOTO:'删除照片', DELETE_VIDEO:'删除视频', DELETE_MUSIC:'删除用户音乐', MAINTENANCE_QUEUED:'创建维护任务', MAINTENANCE_FINISHED:'维护任务结束' }

export function AdminModulePanels({ section, reloadRef, onState, onDirty, onSaving, guard }: {
  section: ExtraSection; reloadRef: RefObject<(() => Promise<boolean>) | null>; onState: (state: ModuleState) => void
  onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void
  guard: (action: () => void) => void
}) {
  const params = useSearchParams()
  const q = (params.get('xq') ?? '').slice(0,200)
  const status = params.get('xstatus') ?? ''
  const kind = params.get('kind') ?? ''
  const page = Math.min(1000000,Math.max(1,Math.floor(Number(params.get('xpage')) || 1)))
  const [notice,setNotice] = useState('')
  const [mutation,setMutation] = useState<Mutation | null>(null)
  const [invite,setInvite] = useState(false)
  const loader = useCallback(async (signal: AbortSignal): Promise<ModuleData> => {
    switch (section) {
      case 'invitations': return { invitations: await adminModules.invitations(page,signal) }
      case 'content': return { trips: await adminModules.trips(q,status,page,signal) }
      case 'media': return { media: await adminModules.media(kind,q,status,page,signal) }
      case 'logs': return { audit: await adminModules.audit(q,page,signal) }
      case 'settings': { const [defaults,runtime] = await Promise.all([adminModules.defaults(signal),adminModules.runtime(signal)]); return { defaults,runtime } }
      case 'maintenance': { const [maintenance,jobs] = await Promise.all([adminModules.maintenance(signal),adminModules.jobs(signal)]); return { maintenance,jobs } }
    }
  }, [section,page,q,status,kind])
  const resource = useAdminResource(loader,true)
  const reload = resource.load
  const loading = resource.loading
  const activeJob = resource.data?.jobs?.some(job => job.status === 'QUEUED' || job.status === 'RUNNING') ?? false
  useEffect(() => { onState({ connected: !!resource.updatedAt && !resource.error, loading: resource.loading, updatedAt: resource.updatedAt }) }, [resource.updatedAt,resource.loading,resource.error,onState])
  useEffect(() => { reloadRef.current = resource.load; return () => { reloadRef.current = null } }, [resource.load,reloadRef])
  useEffect(() => {
    if (section !== 'maintenance' || !activeJob || loading) return
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void reload() },5000)
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange',onVisible)
    return () => { clearInterval(timer);document.removeEventListener('visibilitychange',onVisible) }
  }, [section,activeJob,reload,loading])
  const change = (values: Record<string,string | number>) => {
    const url = new URL(window.location.href)
    Object.entries(values).forEach(([key,value]) => { if (value === '') url.searchParams.delete(key); else url.searchParams.set(key,String(value)) })
    window.history.pushState(null,'',`${url.pathname}${url.search}`)
  }
  const result = resource.data?.invitations ?? resource.data?.trips ?? resource.data?.media ?? resource.data?.audit
  // 删除最后一条记录等情况回退到有效页，保留搜索与筛选条件。
  useEffect(() => {
    if (!result || resource.loading || page <= Math.max(1,Math.ceil(result.total / 25))) return
    const url = new URL(window.location.href);url.searchParams.set('xpage',String(Math.max(1,Math.ceil(result.total / 25))))
    window.history.replaceState(null,'',`${url.pathname}${url.search}`)
  }, [result,resource.loading,page])
  const searchBar = <form className={styles.search} onSubmit={event => { event.preventDefault();change({ xq: String(new FormData(event.currentTarget).get('moduleQuery') ?? '').trim(),xpage: 1 }) }}><Search size={16} /><input key={q} name="moduleQuery" aria-label="搜索当前栏目" maxLength={200} defaultValue={q} placeholder={section === 'logs' ? '操作代码、用户 ID 或审计内容…' : '名称、目的地或用户邮箱…'} /><button className={styles.button}>搜索</button></form>
  async function done() { onDirty(false);setMutation(null);setNotice('操作已完成。');await resource.load() }
  return <section className={styles.moduleSection} aria-label="后台管理栏目" aria-busy={resource.loading}>
    {(q || status || kind) && <div className={styles.moduleFilterSummary}><span>已应用筛选{q ? `：${q}` : ''}</span><button className={styles.button} onClick={() => change({ xq:'',xstatus:'',kind:'',xpage:1 })}>清除筛选</button></div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {resource.error && <p className={styles.error} role="alert">{resource.error}<button className={styles.button} onClick={() => void resource.load()}>重试当前栏目</button></p>}
    {resource.loading && <p className={styles.loadingLine} role="status">正在读取真实数据…</p>}
    {section === 'invitations' && <>
      <div className={styles.toolbar}><div><h2>注册邀请</h2><p>邀请邮件引导用户自行验证邮箱、设置密码；不会自动创建账号。</p></div><button className={styles.primaryButton} onClick={() => setInvite(true)}><Plus size={16} />邀请新用户</button></div>
      <DataTable headings={['受邀用户','进度','最近发送 / 更新','操作']} empty={resource.data?.invitations?.items.length === 0}>
        {resource.data?.invitations?.items.map(i => <tr key={i.id}><td><strong>{i.nickname}</strong><small>{i.email}</small></td><td><span className={styles.levelBadge}>{label(i.status)}</span></td><td>{date(i.updatedAt)}</td><td className={styles.moduleActions}><button className={styles.button} disabled={i.status !== 'PENDING'} onClick={() => setMutation({ title: '重发注册邀请', body: `将向 ${i.email} 重新发送注册邀请。距离上次发送须满一分钟。`,run: () => adminModules.invitationAction(i,'RESEND') })}>重发</button><button className={styles.dangerButton} disabled={i.status !== 'PENDING'} onClick={() => setMutation({ title: '撤销注册邀请',body: '撤销后该邀请不再等待注册；公开注册入口仍然可用。已经注册的用户不会被删除。',run: () => adminModules.invitationAction(i,'REVOKE') })}>撤销</button></td></tr>)}
      </DataTable>
    </>}
    {section === 'content' && <>
      <div className={styles.toolbar}><div><h2>旅行内容</h2><p>归档、分享管理和资源清理均作用于所选旅程。</p></div><div className={styles.filters}>{searchBar}<select aria-label="旅程状态" value={status} onChange={e => change({ xstatus: e.target.value,xpage: 1 })}><option value="">全部状态</option>{['PLANNING','ONGOING','COMPLETED','ARCHIVED','EXPIRED'].map(s => <option key={s} value={s}>{s === 'EXPIRED' ? '已到期' : label(s)}</option>)}</select></div></div>
      <DataTable headings={['旅程 / 所属用户','状态 / 到期','内容数量','操作']} empty={resource.data?.trips?.items.length === 0}>
        {resource.data?.trips?.items.map(t => {
          const expired = t.expired
          return <tr key={t.id}><td><strong>{t.title}</strong><small>{t.destinationName} · #{t.id}</small><small>{t.email}</small></td><td>{label(t.status)}{expired ? ' · 已到期' : ''}<small>{date(t.expiresAt)}</small></td><td>{t.checkins} 个打卡 · {t.photos} 张照片<small>{t.activeShares} 个有效分享</small></td><td><div className={styles.moduleActions}>
            <button className={styles.button} disabled={expired} onClick={() => setMutation({ title: t.status === 'ARCHIVED' ? '取消归档' : '归档旅程',body: t.status === 'ARCHIVED' ? '取消归档后旅程恢复为已完成，保留期限不延长。' : '归档后用户仍可查看内容，编辑需先取消归档。',run: () => adminModules.tripAction(t,t.status === 'ARCHIVED' ? 'UNARCHIVE' : 'ARCHIVE') })}>{t.status === 'ARCHIVED' ? '取消归档' : '归档'}</button>
            <button className={styles.button} disabled={!t.activeShares} onClick={() => setMutation({ title: '撤销全部分享',body: '该旅程现有的全部公开分享链接将失效。用户以后仍可按自身权限重新分享。',run: () => adminModules.tripAction(t,'REVOKE_SHARES') })}>撤销分享</button>
            <button className={styles.dangerButton} onClick={() => setMutation({ title: '永久删除旅程',body: '将删除此旅程、照片、打卡、视频及相关文件，无法撤销。请填写完整旅程名称确认。',expected: t.title,run: text => adminModules.tripAction(t,'DELETE',text) })}>删除</button>
          </div></td></tr>
        })}
      </DataTable>
    </>}
    {section === 'media' && <>
      <div className={styles.toolbar}><div><h2>媒体资源</h2><p>查看真实资源元数据。删除视频和音乐后，文件按原有清理机制处理。</p></div><div className={styles.filters}>{searchBar}<select aria-label="媒体类型" value={kind} onChange={e => change({ kind: e.target.value,xpage: 1 })}><option value="">全部媒体</option>{['PHOTO','VIDEO','MUSIC'].map(k => <option key={k} value={k}>{label(k)}</option>)}</select><select aria-label="媒体状态" value={status} onChange={e => change({ xstatus: e.target.value,xpage: 1 })}><option value="">全部状态</option>{['READY','DRAFT','QUEUED','PROCESSING','COMPLETED','FAILED','UPLOADING','DELETED'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div></div>
      <DataTable headings={['资源 / 用户','类型 / 状态','大小 / 创建时间','操作']} empty={resource.data?.media?.items.length === 0}>
        {resource.data?.media?.items.map(m => <tr key={`${m.kind}-${m.id}`}><td><strong>{m.title}</strong><small>{m.email}</small><small>资源 #{m.id}{m.tripId ? ` · 旅程 #${m.tripId}` : ''}</small></td><td>{label(m.kind)}<small>{label(m.status)}</small></td><td>{m.fileSize == null ? (m.kind === 'VIDEO' ? '暂无成片文件' : '未记录大小') : adminBytes(m.fileSize)}<small>{date(m.createdAt)}</small></td><td><button className={styles.dangerButton} disabled={m.status === 'PROCESSING' && m.kind === 'VIDEO' || m.status === 'DELETED'} title={m.status === 'PROCESSING' && m.kind === 'VIDEO' ? '生成中的视频须完成后才能删除' : undefined} onClick={() => setMutation({ title: `删除${label(m.kind)}`,body: m.kind === 'MUSIC' ? '音乐立即停止供新视频使用；正在排队或生成的视频结束后再清理文件。已生成视频不受影响。' : '将移除此资源及相关引用。照片文件立即清理，视频文件由持久化任务重试清理；无法撤销。',expected: '删除',run: text => adminModules.deleteMedia(m,text) })}>删除资源</button></td></tr>)}
      </DataTable>
    </>}
    {section === 'logs' && <>
      <div className={styles.toolbar}><div><h2>管理操作审计</h2><p>查询真实管理写入记录，时间按当前设备时区显示。</p></div>{searchBar}</div>
      <DataTable headings={['操作 / 时间','操作者 / 目标用户','审计详情']} empty={resource.data?.audit?.items.length === 0}>
        {resource.data?.audit?.items.map(a => <tr key={a.id}><td><strong>{auditLabels[a.action] ?? a.action}</strong><small>{a.action}</small><small>#{a.id} · {date(a.createdAt)}</small></td><td>管理员 #{a.adminId}<small>用户 #{a.userId}</small></td><td><details><summary>查看审计详情</summary><pre className={styles.auditDetails}>{a.details}</pre></details></td></tr>)}
      </DataTable>
    </>}
    {section === 'settings' && resource.data?.defaults && <>
      <DefaultsEditor key={resource.data.defaults.updatedAt} initial={resource.data.defaults} onDirty={onDirty} onSaving={onSaving} onSaved={async () => { setNotice('新账号默认权限已保存；已有账号继续使用各自的配置。');await resource.load() }} />
      {resource.data.runtime && <div className={styles.editorPanel}><h2>运行配置</h2><p className={styles.moduleDescription}>以下为服务器当前配置，只读展示。成本限额独立于会员与账号默认权限。</p><dl className={styles.runtimeGrid}>
        {Object.entries({ '文件存储': resource.data.runtime.storageMode,'邮件通道': resource.data.runtime.mailProvider,'Java 版本': resource.data.runtime.javaVersion,'成本限额': resource.data.runtime.costEnforce ? '已启用' : '仅告警','每账号每日生成次数': resource.data.runtime.accountDailyRenders || '不限','每账号每日成片秒数': resource.data.runtime.accountDailySeconds || '不限','全站同时排队 / 生成': resource.data.runtime.globalActiveRenders || '不限' }).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
      </dl></div>}
    </>}
    {section === 'maintenance' && <>
      <div className={styles.toolbar}><div><h2>数据清理与任务</h2><p>只清理已经到期、已删除或失败的资源；沿用原有冷静期和重试规则。</p></div><button className={styles.button} disabled={resource.loading} onClick={() => void resource.load()}><RefreshCw size={15} />刷新任务</button></div>
      {resource.data?.maintenance && <div className={styles.maintenanceGrid}>{([
        ['TRIPS','到期旅程',resource.data.maintenance.expiredTrips,'每轮最多处理 200 条'],
        ['ACCOUNTS','冷静期已到的账号',resource.data.maintenance.dueAccounts,'每轮最多处理 20 个'],
        ['MUSIC','待清理音乐文件',resource.data.maintenance.musicFiles,'仅处理无活动视频占用的文件'],
      ] as const).map(([kind,title,count,description]) => <article key={kind}><h3>{title}</h3><strong>{count}</strong><p>{description}</p><button className={styles.dangerButton} disabled={activeJob || count === 0} onClick={() => setMutation({ title: `清理${title}`,body: '任务将持久化并在后台执行，关闭页面后仍会继续。失败项保留供后续重试。输入“清理到期数据”确认。',expected: '清理到期数据',run: text => adminModules.enqueue(kind,text) })}>执行本轮清理</button></article>)}</div>}
      <p className={styles.moduleDescription}>待清理的视频文件：{resource.data?.maintenance?.pendingVideoFiles ?? '—'} 个，由 Worker 自动重试。运行中的维护任务每 5 秒刷新一次。</p>
      <DataTable headings={['维护任务','状态 / 创建时间','执行结果']} empty={resource.data?.jobs?.length === 0}>{resource.data?.jobs?.map(j => <tr key={j.id}><td>#{j.id} · {label(j.kind)}</td><td>{label(j.status)}<small>{date(j.createdAt)}</small></td><td>{j.result || '等待后台执行结果'}{j.completedAt && <small>结束：{date(j.completedAt)}</small>}</td></tr>)}</DataTable>
    </>}
    {result && <AdminPagination page={page} total={result.total} pageSize={25} loading={resource.loading} onPage={next => change({ xpage: next })} />}
    {mutation && <MutationDialog mutation={mutation} onClose={() => guard(() => { setMutation(null);onDirty(false) })} onDone={done} onDirty={onDirty} onSaving={onSaving} />}
    {invite && <InviteUserDialog onClose={() => guard(() => { setInvite(false);onDirty(false);void resource.load() })} onDirty={onDirty} onSaving={onSaving} />}
  </section>
}

function DataTable({ headings,children,empty }: { headings: string[]; children: ReactNode; empty?: boolean }) {
  return <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.moduleTable}><thead><tr>{headings.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>{empty && <div className={styles.empty}>暂无符合条件的数据。</div>}</div>
}

function MutationDialog({ mutation,onClose,onDone,onDirty,onSaving }: { mutation: Mutation; onClose: () => void; onDone: () => Promise<void>; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void }) {
  const [confirmation,setConfirmation] = useState('')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  useEffect(() => { onDirty(!!confirmation) }, [confirmation,onDirty])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving || mutation.expected && confirmation !== mutation.expected) return
    setSaving(true);onSaving(true);setError('')
    try { await mutation.run(confirmation);await onDone() }
    catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败，请重新加载后重试。') }
    finally { setSaving(false);onSaving(false) }
  }
  return <AdminDialog title={mutation.title} onClose={() => { if (!saving) onClose() }}><p>{mutation.body}</p><form className={styles.moduleForm} onSubmit={submit}>{mutation.expected && <label>输入「{mutation.expected}」确认<input name="resourceConfirmation" disabled={saving} autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button type="button" className={styles.button} disabled={saving} onClick={onClose}>取消</button><button className={styles.dangerButton} disabled={saving || !!mutation.expected && confirmation !== mutation.expected}>{saving ? '正在执行…' : '确认执行'}</button></div></form></AdminDialog>
}

function DefaultsEditor({ initial,onDirty,onSaving,onSaved }: { initial: RegistrationDefaults; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void; onSaved: () => Promise<void> }) {
  const [draft,setDraft] = useState(initial)
  const [baseline,setBaseline] = useState(initial)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const dirty = JSON.stringify(baseline) !== JSON.stringify(draft)
  useEffect(() => { onDirty(dirty) }, [dirty,onDirty])
  function set<K extends keyof RegistrationDefaults>(key: K,value: RegistrationDefaults[K]) { setDraft(d => ({ ...d,[key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault();if (saving || !dirty) return
    if (!Number.isInteger(draft.tripLimit) || !Number.isInteger(draft.tripRetentionMonths)) { setError('配额和月数须为整数。');return }
    setSaving(true);onSaving(true);setError('')
    try { const updated = await adminModules.saveDefaults(draft);setBaseline(updated);setDraft(updated);onDirty(false);await onSaved() }
    catch (failure) { setError(failure instanceof Error ? failure.message : '默认权限保存失败。') }
    finally { setSaving(false);onSaving(false) }
  }
  return <form className={styles.editorPanel} onSubmit={submit}><h2>新账号默认权限</h2><p className={styles.moduleDescription}>只应用于此后完成注册的普通用户。已有账号通过用户管理单独或批量调整。</p><fieldset className={styles.defaultsFields} disabled={saving}>
    <label>用户等级<input name="defaultLevel" value={draft.userLevel} maxLength={40} required onChange={e => set('userLevel',e.target.value)} /></label>
    <label>旅程上限<input name="defaultTripLimit" type="number" min={1} max={100000} required value={draft.tripLimit} onChange={e => set('tripLimit',Number(e.target.value))} /></label>
    <label>保留月数<input name="defaultRetention" type="number" min={1} max={1200} required value={draft.tripRetentionMonths} onChange={e => set('tripRetentionMonths',Number(e.target.value))} /></label>
    <label>公开分享<select value={String(draft.canShare)} onChange={e => set('canShare',e.target.value === 'true')}><option value="true">允许</option><option value="false">关闭</option></select></label>
    <label>制作视频<select value={String(draft.canVideo)} onChange={e => set('canVideo',e.target.value === 'true')}><option value="true">允许</option><option value="false">关闭</option></select></label>
    <label>自定义音乐<select value={draft.customMusicAccess} onChange={e => set('customMusicAccess',e.target.value as RegistrationDefaults['customMusicAccess'])}><option value="INHERIT">按会员权益</option><option value="ALLOW">管理员开通</option><option value="DENY">停用</option></select></label>
  </fieldset>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button type="button" className={styles.button} disabled={saving || !dirty} onClick={() => { setDraft(baseline);setError('') }}>重置修改</button><button className={styles.primaryButton} disabled={saving || !dirty}>{saving ? '正在保存…' : '保存新账号默认权限'}</button></div></form>
}
