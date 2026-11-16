'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, ShieldCheck, Users } from 'lucide-react'
import { adminApi, type AdminUser, type AdminUserStatus } from '@/services/admin'
import { authApi, userApi, type UserView } from '@/services/tabitrace-api'
import { hasSession } from '@/services/api'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminOverview } from '@/components/admin/AdminOverview'
import { AdminUsersTable } from '@/components/admin/AdminUsersTable'
import { AdminMessages } from '@/components/admin/AdminMessages'
import { UserPermissionsEditor } from '@/components/admin/UserPermissionsEditor'
import { AdminDialog } from '@/components/admin/AdminDialog'
import { useAdminResource } from '@/components/admin/useAdminResource'
import { BulkUserEditor, type BulkEditorConfig, type BulkOperation } from '@/components/admin/BulkUserEditor'
import type { UserWriteResult } from '@/utils/admin-batch'
import styles from '@/components/admin/admin.module.css'
import { adminSections, type AdminSection } from '@/services/admin-modules'
import { AdminModulePanels, type ModuleState } from '@/components/admin/AdminModulePanels'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'
import { DeleteUsersDialog } from '@/components/admin/DeleteUsersDialog'
import { AdminOverviewLinks } from '@/components/admin/AdminOverviewLinks'

const fetchOverview = (signal: AbortSignal) => adminApi.overview(signal)
const positivePage = (value: string | null) => Math.min(1000000, Math.max(1, Math.floor(Number(value) || 1)))

export default function AdminPage() {
  return <Suspense fallback={<main className={styles.authScreen}><ShieldCheck size={30} /><p>正在读取管理后台…</p></main>}><AdminWorkspace /></Suspense>
}

function AdminWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const rawTab = params.get('tab') ?? 'users'
  const tab: AdminSection = Object.hasOwn(adminSections,rawTab) ? rawTab as AdminSection : 'users'
  const showOverview = ['users','messages','overview'].includes(tab)
  const search = (params.get('q') ?? '').trim().slice(0, 200)
  const rawStatus = params.get('status') ?? ''
  const status: AdminUserStatus = rawStatus === 'ACTIVE' || rawStatus === 'DISABLED' || rawStatus === 'DELETION_PENDING' ? rawStatus : ''
  const page = positivePage(params.get('page'))
  const pageSize = [10,25,50].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 25
  const messagePage = positivePage(params.get('mpage'))
  const messageStatus = params.get('mstatus') === 'ALL' ? '' : params.get('mstatus') === 'REPLIED' ? 'REPLIED' : 'OPEN'
  const [me, setMe] = useState<UserView | null>(null)
  const [authError, setAuthError] = useState('')
  const [authAttempt, setAuthAttempt] = useState(0)
  const [queryState, setQueryState] = useState(() => ({ source: search, value: search }))
  if (queryState.source !== search) setQueryState({ source: search, value: search })
  const query = queryState.source === search ? queryState.value : search
  const setQuery = useCallback((value: string) => setQueryState({ source: search, value }), [search])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [batchDirty, setBatchDirty] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<Map<number, AdminUser>>(() => new Map())
  const [bulkEditor, setBulkEditor] = useState<BulkEditorConfig | null>(null)
  const [registrationHelp, setRegistrationHelp] = useState(false)
  const [deletion, setDeletion] = useState<{ ids: number[]; restore: boolean } | null>(null)
  const [moduleDirty, setModuleDirty] = useState(false)
  const [moduleState, setModuleState] = useState<ModuleState>({ connected: false, loading: false, updatedAt: null })
  const moduleReload = useRef<(() => Promise<boolean>) | null>(null)
  const [dirtyMessages, setDirtyMessages] = useState<Set<number>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [discardEpoch, setDiscardEpoch] = useState(0)
  const currentAddress = useRef('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = editorDirty || batchDirty || moduleDirty || dirtyMessages.size > 0
  const fetchUsers = useCallback((signal: AbortSignal) => adminApi.users(search, page, status, pageSize, signal), [search, page, status, pageSize])
  const fetchMessages = useCallback((signal: AbortSignal) => adminApi.messagePage(messageStatus, messagePage, signal), [messageStatus, messagePage])
  const fetchUser = useCallback((signal: AbortSignal) => adminApi.user(selectedId!, signal), [selectedId])
  const overview = useAdminResource(fetchOverview, !!me && showOverview)
  const users = useAdminResource(fetchUsers, !!me && tab === 'users')
  const messages = useAdminResource(fetchMessages, !!me && tab === 'messages')
  const detail = useAdminResource(fetchUser, !!me && selectedId !== null)

  useEffect(() => {
    let cancelled = false
    if (!hasSession()) { router.replace('/login?next=%2Fadmin'); return }
    userApi.me().then(user => {
      if (cancelled) return
      if (user.role !== 'ADMIN') { router.replace('/trips'); return }
      setMe(user)
      setAuthError('')
    }).catch(failure => { if (!cancelled) setAuthError(failure instanceof Error ? failure.message : '登录状态读取失败。') })
    return () => { cancelled = true }
  }, [router, authAttempt])

  // 使用 Next.js 原生 History 接入；传 null，不能回传带 __NA 的 history.state。
  const updateQuery = useCallback((values: Record<string, string | number | null>, push = false) => {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === '') url.searchParams.delete(key)
      else url.searchParams.set(key, String(value))
    }
    const next = `${url.pathname}${url.search}${url.hash}`
    if (push) window.history.pushState(null, '', next)
    else window.history.replaceState(null, '', next)
  }, [])
  useEffect(() => { currentAddress.current = window.location.href }, [params])
  useEffect(() => {
    if (tab !== 'users' || query.trim() === search) return
    searchTimer.current = setTimeout(() => updateQuery({ q: query.trim(), page: 1 }), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, search, tab, updateQuery])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  useEffect(() => {
    if (!dirty && !saving) return
    const onBack = (event: PopStateEvent) => {
      const target = new URL(window.location.href)
      event.stopImmediatePropagation()
      window.history.replaceState(null, '', currentAddress.current)
      if (saving) { setNotice('正在保存，请等待操作完成。'); return }
      setPendingAction(() => () => {
        setSelectedId(null)
        if (target.pathname === '/admin') window.history.pushState(null, '', target.href)
        else router.push(`${target.pathname}${target.search}${target.hash}`)
      })
    }
    window.addEventListener('popstate', onBack, true)
    return () => window.removeEventListener('popstate', onBack, true)
  }, [dirty, saving, router])
  // 修改后当前筛选结果可能缩短：只修正越界页，不清空搜索条件。
  useEffect(() => {
    if (users.data && !users.loading && page > Math.max(1, Math.ceil(users.data.total / pageSize))) updateQuery({ page: Math.max(1, Math.ceil(users.data.total / pageSize)) })
  }, [users.data, users.loading, page, pageSize, updateQuery])
  useEffect(() => {
    if (messages.data && !messages.loading && messagePage > Math.max(1, Math.ceil(messages.data.total / messages.data.pageSize))) updateQuery({ mpage: Math.max(1, Math.ceil(messages.data.total / messages.data.pageSize)) })
  }, [messages.data, messages.loading, messagePage, updateQuery])

  const guard = (action: () => void) => {
    if (saving) { setNotice('正在保存，请等待操作完成。'); return }
    if (dirty) setPendingAction(() => action)
    else action()
  }
  const changeTab = (next: AdminSection) => {
    if (next === tab) return
    guard(() => { setSelectedId(null); setNotice(''); setEditorDirty(false); setModuleDirty(false); setDirtyMessages(new Set()); updateQuery({ tab: next,xq: null,xstatus: null,xpage: null,kind: null }, true) })
  }
  const onMessageDirty = useCallback((id: number, isDirty: boolean) => {
    setDirtyMessages(previous => {
      if (previous.has(id) === isDirty) return previous
      const next = new Set(previous)
      if (isDirty) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  const onEditorDirty = useCallback((isDirty: boolean) => {
    setEditorDirty(isDirty)
    if (isDirty) setNotice('')
  }, [])
  function openBulk(operation: BulkOperation, ids = Array.from(selectedUsers.keys())) {
    if (!ids.length || ids.length > 50) { setNotice('每次请选择 1～50 个用户。'); return }
    guard(() => { setSelectedId(null); setEditorDirty(false); setNotice(''); setBulkEditor({ operation, ids }) })
  }
  async function bulkDone(results: UserWriteResult[]) {
    setBatchDirty(false)
    const failed = results.filter(result => !result.saved)
    setSelectedUsers(new Map(failed.map(result => [result.user.id, result.user])))
    setNotice(`${results.length - failed.length} 项成功，${failed.length} 项未完成。${failed.length ? '请在操作窗口查看每个账号的结果。' : ''}`)
    await Promise.all([users.load(), overview.load()])
  }
  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    const results = await Promise.all(showOverview
      ? [overview.load(), tab === 'overview' ? Promise.resolve(true) : tab === 'users' ? users.load() : messages.load()]
      : [moduleReload.current?.() ?? Promise.resolve(false)])
    setNotice(results.every(Boolean) ? '数据已刷新。' : '部分数据刷新失败，请查看对应模块的提示。')
    setRefreshing(false)
  }
  function requestRefresh() {
    guard(() => {
      if (dirty) {
        setSelectedId(null)
        setDiscardEpoch(value => value + 1)
        if (tab !== 'users' && tab !== 'messages') {
          // 额外栏目随草稿丢弃重新挂载并自行读取，不能再调用即将卸载的旧 load。
          setNotice('未保存的修改已放弃。')
          return
        }
      }
      void refresh()
    })
  }
  async function saved(user: AdminUser) {
    detail.setData(user)
    setEditorDirty(false)
    setNotice('保存成功。保留期限已应用到尚未过期的旅程。')
    await Promise.all([users.load(), overview.load()])
  }
  async function replySaved() {
    setNotice('回复已发送，用户可在留言页面查看。')
    await Promise.all([messages.load(), overview.load()])
  }
  if (!me) return <main className={styles.authScreen}><ShieldCheck size={30} /><p role="status">正在验证管理员身份…</p>{authError && <div className={styles.error} role="alert">{authError}<button className={styles.button} onClick={() => setAuthAttempt(value => value + 1)}>重试验证</button></div>}</main>

  const activeList = tab === 'users' ? users : tab === 'messages' ? messages : null
  const connected = showOverview
    ? !!overview.updatedAt && !overview.error && (tab === 'overview' || !!activeList?.updatedAt && !activeList.error)
    : moduleState.connected
  const currentUser = detail.data?.id === selectedId ? detail.data : null
  return <AdminShell email={me.email} tab={tab} connected={connected} lastUpdated={tab === 'overview' ? overview.updatedAt : activeList?.updatedAt ?? moduleState.updatedAt} refreshing={refreshing || overview.loading || (activeList?.loading ?? (tab === 'overview' ? false : moduleState.loading))}
    onTab={changeTab} onRefresh={requestRefresh} onLogout={() => guard(() => { void authApi.logout().catch(() => undefined).finally(() => router.replace('/login')) })}>
    <div className={styles.pageHeading}>{tab === 'users' ? <Users size={30} /> : tab === 'messages' ? <MessageSquare size={30} /> : <ShieldCheck size={30} />}<div><h1>{adminSections[tab]}</h1><p>{tab === 'users' ? '管理系统注册用户、权限、配额与使用状态。' : tab === 'messages' ? '倾听用户反馈，让每一次旅行记录更安心。' : '查看真实数据，管理平台内容与运行状态。'}</p></div></div>
    {showOverview && <AdminOverview data={overview.data} loading={overview.loading} error={overview.error} onRetry={() => void overview.load()} onMessages={() => changeTab('messages')} />}
    {tab === 'overview' && <AdminOverviewLinks onTab={changeTab} />}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {(tab === 'users' || tab === 'messages') && <nav className={styles.sectionTabs} aria-label="后台栏目"><button className={tab === 'users' ? styles.primaryButton : styles.button} aria-current={tab === 'users' ? 'page' : undefined} onClick={() => changeTab('users')}><Users size={17} />用户管理{overview.data ? `（${overview.data.users.toLocaleString('zh-CN')}）` : ''}</button><button className={tab === 'messages' ? styles.primaryButton : styles.button} aria-current={tab === 'messages' ? 'page' : undefined} onClick={() => changeTab('messages')}><MessageSquare size={17} />留言管理{overview.data?.openMessages ? <span className={styles.tabBadge}>{overview.data.openMessages}</span> : null}</button></nav>}
    {tab === 'users' ? <AdminUsersTable data={users.data} loading={users.loading} error={users.error} query={query} status={status} page={page} pageSize={pageSize} selectedId={selectedId} selectedUsers={selectedUsers}
      onQuery={setQuery} onSearch={() => { if (searchTimer.current) clearTimeout(searchTimer.current); updateQuery({ q: query.trim(), page: 1 }) }}
      onStatus={next => updateQuery({ status: next, page: 1 })} onPage={next => updateQuery({ page: next }, true)} onPageSize={size => updateQuery({ pageSize: size, page: 1 })}
      onSelect={id => { if (id !== selectedId) guard(() => { setSelectedId(id); setEditorDirty(false); setNotice('') }) }}
      onReset={() => { setQuery(''); updateQuery({ q: null, status: null, page: 1 }) }} onRetry={() => void users.load()}
      onToggleUser={user => setSelectedUsers(previous => { const next = new Map(previous); if (next.has(user.id)) next.delete(user.id); else next.set(user.id, user); return next })}
      onTogglePage={() => setSelectedUsers(previous => { const eligible = users.data?.items.filter(user => user.status !== 'DELETION_PENDING') ?? []; const clear = eligible.every(user => previous.has(user.id)); const next = new Map(previous); for (const user of eligible) { if (clear) next.delete(user.id); else next.set(user.id, user) }; return next })}
      onBulk={operation => openBulk(operation)} onAdd={() => guard(() => setRegistrationHelp(true))} onUserStatus={user => openBulk(user.status === 'DISABLED' ? 'activate' : 'disable', [user.id])} onNotice={setNotice} onDeleteUsers={(ids,restore) => { if (ids.length < 1 || ids.length > 50) { setNotice('每次请选择 1～50 个用户。'); return }; guard(() => { setSelectedId(null);setDeletion({ ids,restore }) }) }} />
      : tab === 'messages' ? <AdminMessages key={discardEpoch} data={messages.data} loading={messages.loading} error={messages.error} page={messagePage} status={messageStatus}
        onStatus={next => guard(() => { setDirtyMessages(new Set()); updateQuery({ mstatus: next || 'ALL', mpage: 1 }) })}
        onPage={next => guard(() => { setDirtyMessages(new Set()); updateQuery({ mpage: next }, true) })}
        onRetry={() => void messages.load()} onSaved={replySaved} onDirty={onMessageDirty} /> : tab !== 'overview' ? <AdminModulePanels key={`${tab}-${discardEpoch}`} section={tab} reloadRef={moduleReload} onState={setModuleState} onDirty={setModuleDirty} onSaving={setSaving} guard={guard} /> : null}
    {selectedId && detail.loading && tab === 'users' && <div className={styles.editorPanel} role="status">正在读取最新用户资料…</div>}
    {selectedId && detail.error && tab === 'users' && <div className={styles.error} role="alert">用户详情读取失败：{detail.error}<button className={styles.button} onClick={() => void detail.load()}>重试详情</button></div>}
    {currentUser && <UserPermissionsEditor key={`${currentUser.id}-${currentUser.updatedAt}-${discardEpoch}`} user={currentUser} visible={tab === 'users'}
      onCancel={() => guard(() => { setSelectedId(null); setEditorDirty(false) })} onReload={() => guard(() => { setEditorDirty(false); detail.setData(null); void detail.load() })}
      onSaved={saved} onDirtyChange={onEditorDirty} onSavingChange={setSaving} />}
    {registrationHelp && <InviteUserDialog onClose={() => guard(() => { setRegistrationHelp(false);setModuleDirty(false) })} onDirty={setModuleDirty} onSaving={setSaving} />}
    {deletion && <DeleteUsersDialog ids={deletion.ids} restore={deletion.restore} onClose={() => guard(() => { setDeletion(null);setModuleDirty(false) })} onDirty={setModuleDirty} onSaving={setSaving} onDone={bulkDone} />}{bulkEditor && <BulkUserEditor config={bulkEditor} onClose={() => guard(() => { setBulkEditor(null); setBatchDirty(false) })} onDirtyChange={setBatchDirty} onSavingChange={setSaving} onDone={bulkDone} />}
    {pendingAction && <AdminDialog title="有未保存的修改" onClose={() => setPendingAction(null)}><p>离开后将放弃当前填写的内容。要继续编辑，还是放弃修改？</p><div className={styles.dialogActions}><button className={styles.button} onClick={() => setPendingAction(null)}>继续编辑</button><button className={styles.dangerButton} onClick={() => { const action = pendingAction; setPendingAction(null); setEditorDirty(false); setBatchDirty(false); setBulkEditor(null); setModuleDirty(false); setRegistrationHelp(false); setDeletion(null); setDirtyMessages(new Set()); setDiscardEpoch(value => value + 1); action() }}>放弃修改</button></div></AdminDialog>}
  </AdminShell>
}
