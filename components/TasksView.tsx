'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Task, Client } from '@/lib/types'
import {
  getTasksByDate,
  createTask,
  updateTask,
  deleteTask,
  getClients,
} from '@/lib/db'
import { toISO, fmtDate, TIPO_LABEL, chipResp, MNS, DLONG } from '@/lib/utils'

const RESP_ELLEN = 'Ellen Maximiano'
const RESP_ANDREWS = 'Andrews Maximiano'
const RESP_SUPORTE = 'Suporte'

const PRIORITY_COLOR: Record<string, string> = {
  alta: '#DC2626',
  media: '#F59E0B',
  baixa: '#10B981',
}

type StatusKey = 'pendente' | 'aguardando' | 'concluida'

const STATUS_META: Record<StatusKey, { label: string; order: number }> = {
  pendente: { label: 'PENDENTE', order: 1 },
  aguardando: { label: 'AGUARDANDO CLIENTE', order: 2 },
  concluida: { label: 'CONCLUÍDA', order: 3 },
}

type FilterKey =
  | 'sincronizadas'
  | 'ellen'
  | 'andrews'
  | 'prev'
  | 'contab'

function statusOf(t: Task): StatusKey {
  const s = (t as any).status as StatusKey | undefined
  if (s === 'aguardando' || s === 'concluida' || s === 'pendente') return s
  return t.done ? 'concluida' : 'pendente'
}

function formatBRLong(iso: string): string {
  const today = toISO(new Date())
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const prefix = iso === today ? 'Hoje — ' : ''
  return `${prefix}${d} de ${MNS ? MNS[m - 1] : dt.toLocaleDateString('pt-BR', { month: 'long' })} de ${y}`
}

type SyncGroup = {
  key: string
  via: { client?: string; atendente?: string }
  tasks: Task[]
}

function groupBySync(tasks: Task[]): { groups: SyncGroup[]; solo: Task[] } {
  const map = new Map<string, Task[]>()
  const solo: Task[] = []
  for (const t of tasks) {
    if (t.sync_group) {
      const arr = map.get(t.sync_group) || []
      arr.push(t)
      map.set(t.sync_group, arr)
    } else {
      solo.push(t)
    }
  }
  const groups: SyncGroup[] = []
  for (const [key, arr] of map) {
    if (arr.length < 2) {
      solo.push(...arr)
      continue
    }
    const orig = arr.find((t) => (t as any).sync_orig) || arr[0]
    groups.push({
      key,
      via: {
        client: orig.client_name,
        atendente: (orig as any).resp,
      },
      tasks: arr,
    })
  }
  return { groups, solo }
}

export default function TasksView() {
  const [date, setDate] = useState<string>(toISO(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Task | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const [ts, cs] = await Promise.all([getTasksByDate(date), getClients()])
      setTasks(ts)
      setClients(cs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function toggleFilter(k: FilterKey) {
    const n = new Set(filters)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    setFilters(n)
  }
  function clearFilters() {
    setFilters(new Set())
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (q) {
        const hay = `${t.title || ''} ${t.client_name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.size === 0) return true

      const hasResp = filters.has('ellen') || filters.has('andrews')
      const hasTipo = filters.has('prev') || filters.has('contab')
      const hasSync = filters.has('sincronizadas')

      if (hasResp) {
        const r = (t as any).resp || ''
        const okE = filters.has('ellen') && r === RESP_ELLEN
        const okA = filters.has('andrews') && r === RESP_ANDREWS
        if (!okE && !okA) return false
      }
      if (hasTipo) {
        const tp = (t as any).tipo || ''
        const okP = filters.has('prev') && tp === 'prev'
        const okC = filters.has('contab') && tp === 'contab'
        if (!okP && !okC) return false
      }
      if (hasSync) {
        if (!t.sync_group) return false
      }
      return true
    })
  }, [tasks, filters, search])

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { pendente: 0, aguardando: 0, concluida: 0 }
    for (const t of filtered) c[statusOf(t)]++
    return c
  }, [filtered])

  const sections = useMemo(() => {
    const byStatus: Record<StatusKey, Task[]> = {
      pendente: [],
      aguardando: [],
      concluida: [],
    }
    for (const t of filtered) byStatus[statusOf(t)].push(t)
    return (['pendente', 'aguardando', 'concluida'] as StatusKey[]).map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      tasks: byStatus[s],
    }))
  }, [filtered])

  async function onToggleDone(t: Task) {
    const next = statusOf(t) === 'concluida' ? 'pendente' : 'concluida'
    await updateTask(t.id, { status: next, done: next === 'concluida' } as any)
    await reload()
  }
  async function onChangeStatus(t: Task, s: StatusKey) {
    await updateTask(t.id, { status: s, done: s === 'concluida' } as any)
    await reload()
  }
  async function onDelete(t: Task) {
    if (!confirm(`Excluir tarefa "${t.title}"?`)) return
    await deleteTask(t.id)
    setDetail(null)
    await reload()
  }

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setDate(toISO(new Date()))}>
          Hoje
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          style={{ padding: '6px 10px' }}
        />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nova tarefa
        </button>
      </div>

      <h2 style={{ margin: '14px 0 8px', fontSize: 18 }}>{formatBRLong(date)}</h2>

      <input
        className="input"
        placeholder="Buscar tarefa ou cliente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <FilterChip active={filters.size === 0} onClick={clearFilters} label="Todas" />
        <FilterChip
          active={filters.has('sincronizadas')}
          onClick={() => toggleFilter('sincronizadas')}
          label="Sincronizadas"
        />
        <FilterChip
          active={filters.has('ellen')}
          onClick={() => toggleFilter('ellen')}
          label="Ellen"
        />
        <FilterChip
          active={filters.has('andrews')}
          onClick={() => toggleFilter('andrews')}
          label="Andrews"
        />
        <FilterChip
          active={filters.has('prev')}
          onClick={() => toggleFilter('prev')}
          label="Previdenciário"
        />
        <FilterChip
          active={filters.has('contab')}
          onClick={() => toggleFilter('contab')}
          label="Contabilidade"
        />
      </div>

      {loading && <div style={{ opacity: 0.6 }}>Carregando...</div>}

      {!loading &&
        sections.map((sec) => (
          <section key={sec.key} style={{ marginBottom: 18 }}>
            <h3
              style={{
                fontSize: 13,
                letterSpacing: 0.5,
                color: '#64748b',
                margin: '8px 0',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: 4,
              }}
            >
              {sec.label} ({sec.tasks.length})
            </h3>
            {sec.tasks.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: 13, padding: '6px 2px' }}>—</div>
            )}
            <SectionBody tasks={sec.tasks} onToggle={onToggleDone} onOpen={setDetail} />
          </section>
        ))}

      {showForm && (
        <NewTaskForm
          date={date}
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await reload()
          }}
        />
      )}

      {detail && (
        <DetailModal
          task={detail}
          onClose={() => setDetail(null)}
          onChangeStatus={onChangeStatus}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        border: '1px solid ' + (active ? '#0f172a' : '#cbd5e1'),
        background: active ? '#0f172a' : '#fff',
        color: active ? '#fff' : '#334155',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function SectionBody({
  tasks,
  onToggle,
  onOpen,
}: {
  tasks: Task[]
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}) {
  const { groups, solo } = groupBySync(tasks)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((g) => (
        <div
          key={g.key}
          style={{
            border: '1px dashed #94a3b8',
            borderRadius: 8,
            padding: 8,
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#475569',
              letterSpacing: 0.5,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            SINCRONIZADAS | Via: {g.via.client || '—'}
            {g.via.atendente ? ` (${g.via.atendente})` : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.tasks.map((t) => (
              <TaskCard key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
      {solo.map((t) => (
        <TaskCard key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} />
      ))}
    </div>
  )
}

function TaskCard({
  task,
  onToggle,
  onOpen,
}: {
  task: Task
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
}) {
  const prio = (task as any).priority || 'media'
  const barColor = PRIORITY_COLOR[prio] || PRIORITY_COLOR.media
  const isDone = statusOf(task) === 'concluida'
  const resp = (task as any).resp as string | undefined
  const tipo = (task as any).tipo as string | undefined

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,.04)',
      }}
    >
      <div style={{ width: 4, background: barColor }} />
      <div style={{ flex: 1, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={isDone}
            onChange={() => onToggle(task)}
            style={{ width: 18, height: 18 }}
          />
          <button
            onClick={() => onOpen(task)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              flex: 1,
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? '#94a3b8' : '#0f172a',
              fontWeight: 500,
            }}
          >
            {task.title}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {task.client_name && <Chip>{task.client_name}</Chip>}
          {resp && <Chip className={chipResp ? chipResp(resp) : ''}>{resp}</Chip>}
          {tipo && <Chip>{TIPO_LABEL ? TIPO_LABEL[tipo] || tipo : tipo}</Chip>}
          {task.sync_group && <Chip>Sync</Chip>}
        </div>
      </div>
    </div>
  )
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={className}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: '#f1f5f9',
        color: '#334155',
        border: '1px solid #e2e8f0',
      }}
    >
      {children}
    </span>
  )
}

function NewTaskForm({
  date,
  clients,
  onClose,
  onSaved,
}: {
  date: string
  clients: Client[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState<string>('')
  const [resp, setResp] = useState<string>(RESP_ELLEN)
  const [tipo, setTipo] = useState<string>('prev')
  const [data, setData] = useState(date)
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>('media')
  const [status, setStatus] = useState<StatusKey>('pendente')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const client = clients.find((c) => String(c.id) === clientId)
      const payload: any = {
        title: title.trim(),
        date: data,
        priority,
        status,
        done: status === 'concluida',
        notes: notes.trim() || null,
        resp,
        tipo,
        client_id: client ? client.id : null,
        client_name: client ? client.name : null,
      }
      await createTask(payload)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 18,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 40px rgba(0,0,0,.2)',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18 }}>Nova tarefa</h3>

        <Field label="Título">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            style={fieldStyle}
          />
        </Field>

        <Field label="Cliente">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={fieldStyle}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Responsável">
            <select value={resp} onChange={(e) => setResp(e.target.value)} style={fieldStyle}>
              <option value={RESP_ELLEN}>Ellen</option>
              <option value={RESP_ANDREWS}>Andrews</option>
              <option value={RESP_SUPORTE}>Suporte</option>
            </select>
          </Field>
          <Field label="Área">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={fieldStyle}>
              <option value="prev">Previdenciário</option>
              <option value="contab">Contabilidade</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Data">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              style={fieldStyle}
            />
          </Field>
          <Field label="Prioridade">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              style={fieldStyle}
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Field>
        </div>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusKey)}
            style={fieldStyle}
          >
            <option value="pendente">Pendente</option>
            <option value="aguardando">Aguardando cliente</option>
            <option value="concluida">Concluída</option>
          </select>
        </Field>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailModal({
  task,
  onClose,
  onChangeStatus,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onChangeStatus: (t: Task, s: StatusKey) => void
  onDelete: (t: Task) => void
}) {
  const s = statusOf(task)
  const notes = (task as any).notes as string | undefined
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 18,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 20px 40px rgba(0,0,0,.2)',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 10, fontSize: 18 }}>{task.title}</h3>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
          {task.client_name && <div>Cliente: {task.client_name}</div>}
          {(task as any).resp && <div>Responsável: {(task as any).resp}</div>}
          {(task as any).tipo && (
            <div>Área: {TIPO_LABEL ? TIPO_LABEL[(task as any).tipo] : (task as any).tipo}</div>
          )}
          <div>Data: {fmtDate ? fmtDate(task.date) : task.date}</div>
          <div>Prioridade: {(task as any).priority || 'media'}</div>
        </div>

        {notes && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 10,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              marginBottom: 10,
            }}
          >
            {notes}
          </div>
        )}

        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Alterar status:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['pendente', 'aguardando', 'concluida'] as StatusKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onChangeStatus(task, k)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                border: '1px solid ' + (s === k ? '#0f172a' : '#cbd5e1'),
                background: s === k ? '#0f172a' : '#fff',
                color: s === k ? '#fff' : '#334155',
                cursor: 'pointer',
              }}
            >
              {STATUS_META[k].label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            className="btn"
            onClick={() => onDelete(task)}
            style={{ color: '#b91c1c' }}
          >
            Excluir
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  background: '#fff',
}
