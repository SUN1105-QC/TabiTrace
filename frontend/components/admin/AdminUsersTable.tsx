'use client'

import { useId, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Pencil, Plus, Search, Share2, Shield, Trash2, Users, X, XCircle } from 'lucide-react'
import type { AdminPageResult, AdminUser, AdminUserStatus } from '@/services/admin'
import type { BulkOperation } from './BulkUserEditor'
import { adminStatus } from '@/utils/admin-users'
import styles from './admin.module.css'

function Avatar({ user }: { user: AdminUser }) {
  const [failed, setFailed] = useState(false)
  const safe = user.avatarUrl && (/^https?:\/\//i.test(user.avatarUrl) || /^\/(?!\/)/.test(user.avatarUrl))
  return <span className={styles.avatar}>{safe && !failed
    ? <img src={user.avatarUrl!} alt="" loading="lazy" onError={() => setFailed(true)} />
    : (user.nickname.trim()[0] || '旅').toLocaleUpperCase()}</span>
}

function UserActions({ user, onStatus, onNotice, onDelete }: { user: AdminUser; onStatus: (user: AdminUser) => void; onNotice: (message: string) => void; onDelete: (user: AdminUser) => void }) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  function close() { menu.current?.hidePopover(); trigger.current?.focus() }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); onNotice(`${label}已复制。`) }
    catch { onNotice(`复制不可用，请手动复制：${text}`) }
    close()
  }
  return <>
    <button type="button" ref={trigger} className={styles.rowMore} aria-label={`更多操作：${user.nickname}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => {
      const box = trigger.current!.getBoundingClientRect()
      setPosition({ top: Math.min(box.bottom + 5, window.innerHeight - 180), left: Math.max(8, Math.min(box.right - 180, window.innerWidth - 188)) })
      if (open) close(); else { menu.current?.showPopover(); menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() }
    }}><MoreHorizontal size={18} /></button>
    <div id={id} ref={menu} popover="auto" role="menu" aria-label={`${user.nickname} 的更多操作`} className={styles.rowMenu} style={position} onToggle={event => setOpen(event.currentTarget.matches(':popover-open'))} onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus() }
      if (event.key === 'Escape') { event.preventDefault(); close() }
    }}>
      <button role="menuitem" onClick={() => void copy(user.email, '邮箱')}><Copy size={14} />复制邮箱</button>
      <button role="menuitem" onClick={() => void copy(String(user.id), '用户 ID')}><Copy size={14} />复制用户 ID</button>
      <button role="menuitem" disabled={user.status === 'DELETION_PENDING'} onClick={() => { close(); onStatus(user) }}>{user.status === 'DISABLED' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{user.status === 'DISABLED' ? '启用账号' : '停用账号'}</button>
      <button role="menuitem" className={styles.deleteButton} onClick={() => { close();onDelete(user) }}><Trash2 size={14} />{user.status === 'DELETION_PENDING' ? '撤销删除' : '删除用户'}</button>
    </div>
  </>
}

export function AdminPagination({ page, total, pageSize, loading, onPage }: { page: number; total: number; pageSize: number; loading: boolean; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav className={styles.pagination} aria-label="列表分页"><span>共 {total.toLocaleString('zh-CN')} 条</span><button className={styles.iconButton} aria-label="上一页" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button><span className={styles.currentPage} aria-current="page">{page}</span><button className={styles.iconButton} aria-label="下一页" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button><span>共 {pages.toLocaleString('zh-CN')} 页</span></nav>
}

export function AdminUsersTable({ data, loading, error, query, status, page, pageSize, selectedId, selectedUsers, onQuery, onSearch, onStatus, onPage, onPageSize, onSelect, onReset, onRetry, onToggleUser, onTogglePage, onBulk, onAdd, onUserStatus, onNotice, onDeleteUsers }: {
  data: AdminPageResult<AdminUser> | null; loading: boolean; error: string; query: string; status: AdminUserStatus
  page: number; pageSize: number; selectedId: number | null; onQuery: (value: string) => void; onSearch: () => void
  onStatus: (status: AdminUserStatus) => void; onPage: (page: number) => void; onPageSize: (size: number) => void
  onSelect: (id: number) => void; onReset: () => void; onRetry: () => void
  selectedUsers: Map<number, AdminUser>; onToggleUser: (user: AdminUser) => void; onTogglePage: () => void
  onBulk: (operation: BulkOperation) => void; onAdd: () => void; onUserStatus: (user: AdminUser) => void; onNotice: (message: string) => void
  onDeleteUsers: (ids: number[], restore: boolean) => void
}) {
  const selectable = data?.items.filter(user => user.status !== 'DELETION_PENDING') ?? []
  const allSelected = selectable.length > 0 && selectable.every(user => selectedUsers.has(user.id))
  const someSelected = selectable.some(user => selectedUsers.has(user.id))
  const pageCheckbox = (label: string) => <input type="checkbox" aria-label={label} checked={allSelected} ref={element => { if (element) element.indeterminate = someSelected && !allSelected }} onChange={onTogglePage} disabled={!selectable.length || loading} />
  return <section className={styles.usersSection} aria-label="普通用户">
    <div className={styles.toolbar}><div className={styles.toolbarLead}><h2>普通用户</h2><p>共 {data?.total.toLocaleString('zh-CN') ?? '—'} 人 · 管理用户账号、权限与配额。</p></div>
      <div className={styles.filters}><form className={styles.search} onSubmit={event => { event.preventDefault(); onSearch() }}><button type="submit" className={styles.searchSubmit} aria-label="立即搜索"><Search size={16} /></button><input value={query} onChange={event => onQuery(event.target.value)} aria-label="搜索用户邮箱或昵称" maxLength={200} placeholder="搜索用户昵称或邮箱…" />{query && <button type="button" className={styles.iconButton} aria-label="清空搜索" onClick={() => onQuery('')}><X size={15} /></button>}</form>
        <label className={styles.srOnly} htmlFor="admin-user-status">账号状态</label><select id="admin-user-status" value={status} onChange={event => onStatus(event.target.value as AdminUserStatus)}><option value="">全部状态</option><option value="ACTIVE">正常</option><option value="DISABLED">已停用</option><option value="DELETION_PENDING">注销冷静期</option></select>
        <button className={styles.primaryButton} onClick={onAdd}><Plus size={16} />新增用户</button>
      </div>
    </div>
    {error && <div className={styles.error} role="alert">用户列表读取失败：{error}<button className={styles.button} onClick={onRetry}>重试列表</button></div>}
    <div className={styles.tableCard} aria-busy={loading}>
      {loading && <p className={styles.loadingLine} role="status">正在读取用户…</p>}
      <div className={styles.tableScroll}><table className={styles.usersTable}><thead><tr><th scope="col" className={styles.checkColumn}>{pageCheckbox('选择当前页全部可编辑用户')}</th>{['用户', '等级 / 状态', '旅程 / 上限', '保留月数', '功能权限', '操作'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data?.items.map(user => <tr key={user.id} data-selected={user.id === selectedId || selectedUsers.has(user.id)} onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input,[role=menu]') && user.status !== 'DELETION_PENDING') onSelect(user.id) }}>
          <td className={styles.checkColumn}><input type="checkbox" aria-label={`选择用户：${user.nickname}`} checked={selectedUsers.has(user.id)} disabled={user.status === 'DELETION_PENDING' && !selectedUsers.has(user.id)} onChange={() => onToggleUser(user)} /></td>
          <td data-label="用户"><div className={styles.userIdentity}><Avatar user={user} /><div><strong title={user.nickname}>{user.nickname || '未设置昵称'}</strong><span className={styles.userEmail} title={user.email}>{user.email}</span></div></div></td>
          <td data-label="等级 / 状态"><div className={styles.userBadges}><span className={styles.levelBadge}>{user.userLevel}</span><span className={styles.statusBadge} data-status={user.status}><i />{adminStatus(user.status)}</span></div></td>
          <td data-label="旅程 / 上限"><span className={user.trips >= user.tripLimit ? styles.quotaWarning : ''}>{user.trips.toLocaleString('zh-CN')} / {user.tripLimit.toLocaleString('zh-CN')}</span></td>
          <td data-label="保留月数">{user.tripRetentionMonths.toLocaleString('zh-CN')} 个月</td>
          <td data-label="功能权限"><span className={styles.permissionText} title={`公开分享：${user.canShare ? '开启' : '关闭'}；制作视频：${user.canVideo ? '开启' : '关闭'}；自定义音乐：${user.customMusicAccess === 'ALLOW' ? '管理员开通' : user.customMusicAccess === 'DENY' ? '停用' : '按会员权益'}`}><Share2 size={12} aria-hidden="true" /><span data-enabled={user.canShare}>分享</span><i>·</i><span data-enabled={user.canVideo}>视频</span><i>·</i><span data-enabled={user.customMusicAccess !== 'DENY'}>音乐</span>{user.customMusicAccess === 'INHERIT' && <span className={styles.musicInherited}>· 按会员</span>}</span></td>
          <td data-label="操作"><div className={styles.rowActions}><button className={styles.button} disabled={user.status === 'DELETION_PENDING'} title={user.status === 'DELETION_PENDING' ? '注销冷静期账号不能修改权限' : `编辑 ${user.nickname} 的权限`} onClick={() => onSelect(user.id)}><Pencil size={14} />编辑权限</button><UserActions user={user} onStatus={onUserStatus} onNotice={onNotice} onDelete={u => onDeleteUsers([u.id],u.status === 'DELETION_PENDING')} /></div>{user.status === 'DELETION_PENDING' && <small className={styles.readOnlyNote}>注销中 · 只读</small>}</td>
        </tr>)}</tbody></table></div>
      {!loading && !error && data?.items.length === 0 && <div className={styles.empty}><Users size={30} /><h3>{query || status ? '没有匹配的用户' : '暂无普通用户'}</h3><p>{query || status ? '试试其他昵称、邮箱或状态。' : '注册后的用户会显示在这里。'}</p>{(query || status) && <button className={styles.button} onClick={onReset}>清除筛选</button>}</div>}
      <footer className={styles.tableFooter}>
        <div className={styles.bulkBar}><label>{pageCheckbox('选择或取消当前页用户')}<span>已选择 {selectedUsers.size} 项</span></label><button className={styles.button} disabled={!selectedUsers.size || loading} onClick={() => onBulk('permissions')}><Shield size={13} />批量修改权限</button><button className={styles.button} disabled={!selectedUsers.size || loading} onClick={() => onBulk('activate')}><CheckCircle2 size={13} />启用</button><button className={styles.button} disabled={!selectedUsers.size || loading} onClick={() => onBulk('disable')}><XCircle size={13} />停用</button><button className={`${styles.button} ${styles.deleteButton}`} disabled={!selectedUsers.size || loading} onClick={() => onDeleteUsers(Array.from(selectedUsers.keys()),false)}><Trash2 size={13} />删除</button></div>
        <div className={styles.pageTools}><label className={styles.pageSize}>每页 <select aria-label="每页用户数量" value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[10,25,50].map(size => <option key={size} value={size}>{size} 条</option>)}</select></label><AdminPagination page={page} total={data?.total ?? 0} pageSize={pageSize} loading={loading} onPage={onPage} /></div>
      </footer>
    </div>
  </section>
}
