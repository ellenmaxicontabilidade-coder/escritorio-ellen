'use client'
import { useState, useEffect, useCallback } from 'react'
import { getTasksByDate, createTask, updateTask, deleteTask } from '@/lib/db'
import { getClients } from '@/lib/db'
import { MNS, DLONG, toISO, pad, TIPO_LABEL, chipResp } from '@/lib/utils'
import type { Task, Client } from '@/lib/types'

const TODAY = toISO(new Date())
const DNS7 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

interface Props { showToast: (msg: string, type?: 'success' | 'danger') => void }

export default function TasksView({ showToast }: Props) {
  const now = new Date()
  const [selDay, setSelDay] = useState(TODAY)
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [flt, setFlt] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showCal, setShowCal] = useState(false)
  const [tcpYear, setTcpYear] = useState(now.getFullYear())
  const [tcpMonth, setTcpMonth] = useState(now.getMonth())
  const [form, setForm] = useState({ title:'', clientId:'', service:'', area:'prev', priority:'media', resp:'Ellen Maximiano', date: TODAY, time:'' })
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title:'', clientId:'', service:'', area:'', priority:'', resp:'', date:'' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try { setTasks(await getTasksByDate(selDay)) }
    finally { setLoading(false) }
  }, [selDay])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { getClients().then(setClients) }, [])

  async function toggleTask(task: Task) {
    await updateTask(task.id, { done: !task.done })
    if (task.sync_group) {
      const mirrors = tasks.filter(t => t.sync_group === task.sync_group && t.id !== task.id)
      await Promise.all(mirrors.map(m => updateTask(m.id, { done: !task.done })))
    }
    loadTasks()
  }

  async function saveTask() {
    if (!form.title.trim()) return
    const cli = clients.find(c => c.id === form.clientId)
    await createTask({
      title: form.title,
      client_name: cli?.name || '—',
      client_id: form.clientId || undefined,
      service: form.service || '—',
      resp: form.resp as any,
      tipo: form.area as any,
      priority: form.priority as any,
      done: false,
      date: form.date || selDay,
    })
    setShowModal(false)
    setForm({ title:'', clientId:'', service:'', area:'prev', priority:'media', resp:'Ellen Maximiano', date: TODAY, time:'' })
    showToast('Tarefa criada!')
    loadTasks()
  }


  function openDetail(task: Task) {
    setDetailTask(task)
    setEditMode(false)
    setConfirmDelete(false)
    const cli = clients.find(c => c.name === task.client_name)
    setEditForm({
      title: task.title,
      clientId: cli?.id || '',
      service: task.service === '—' ? '' : task.service,
      area: task.tipo,
      priority: task.priority,
      resp: task.resp,
      date: task.date,
    })
  }

  async function saveEdit() {
    if (!detailTask || !editForm.title.trim()) return
    const cli = clients.find(c => c.id === editForm.clientId)
    await updateTask(detailTask.id, {
      title: editForm.title,
      client_name: cli?.name || detailTask.client_name,
      client_id: editForm.clientId || undefined,
      service: editForm.service || '—',
      resp: editForm.resp as any,
      tipo: editForm.area as any,
      priority: editForm.priority as any,
      date: editForm.date || detailTask.date,
    })
    if (detailTask.sync_group) {
      const mirrors = tasks.filter(t => t.sync_group === detailTask.sync_group && t.id !== detailTask.id)
      await Promise.all(mirrors.map(m => updateTask(m.id, {
        title: editForm.title,
        service: editForm.service || '—',
        resp: editForm.resp as any,
        tipo: editForm.area as any,
        priority: editForm.priority as any,
      })))
    }
    setDetailTask(null)
    setEditMode(false)
    showToast('Tarefa atualizada!')
    loadTasks()
  }

  async function handleDelete() {
    if (!detailTask) return
    if (detailTask.sync_group) {
      const mirrors = tasks.filter(t => t.sync_group === detailTask.sync_group && t.id !== detailTask.id)
      await Promise.all(mirrors.map(m => deleteTask(m.id)))
    }
    await deleteTask(detailTask.id)
    setDetailTask(null)
    setConfirmDelete(false)
    showToast('Tarefa excluída!', 'danger')
    loadTasks()
  }

  function filtered() {
    let fl = [...tasks]
    if (flt === 'sync') fl = fl.filter(t => !!t.sync_group)
    else if (flt === 'Ellen Maximiano' || flt === 'Andrews Maximiano') fl = fl.filter(t => t.resp === flt)
    else if (flt !== 'all') fl = fl.filter(t => t.tipo === flt)
    if (search) fl = fl.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.client_name.toLowerCase().includes(search.toLowerCase()))
    return fl
  }

  function buildTcpDays() {
    const first = new Date(tcpYear, tcpMonth, 1).getDay()
    const dim = new Date(tcpYear, tcpMonth + 1, 0).getDate()
    const dip = new Date(tcpYear, tcpMonth, 0).getDate()
    const cells = []
    for (let i = 0; i < first; i++) cells.push({ d: dip - first + 1 + i, iso: null })
    for (let d = 1; d <= dim; d++) cells.push({ d, iso: `${tcpYear}-${pad(tcpMonth + 1)}-${pad(d)}` })
    const rem = (first + dim) % 7 === 0 ? 0 : 7 - ((first + dim) % 7)
    for (let i = 1; i <= rem; i++) cells.push({ d: i, iso: null })
    return cells
  }

  const fl = filtered()
  const pending = fl.filter(t => !t.done)
  const done = fl.filter(t => t.done)
  const d = new Date(selDay + 'T12:00')
  const dateLabel = selDay === TODAY
    ? `Hoje — ${d.getDate()} de ${MNS[d.getMonth()]} de ${d.getFullYear()}`
    : `${DLONG[d.getDay()]}, ${d.getDate()} de ${MNS[d.getMonth()]} de ${d.getFullYear()}`

  const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  const AREA_LABEL: Record<string, string> = { prev: 'Previdenciário', contab: 'Contabilidade', assess: 'Cont. | Assessoria', assessoria: 'Assessoria', cliente: 'Cliente', interno: 'Interno' }

  function renderTask(task: Task) {
    const pc = task.priority === 'alta' ? '#E24B4A' : task.priority === 'media' ? '#EF9F27' : '#639922'
    return (
      <div key={task.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border-light)', opacity: task.done ? 0.45 : 1, cursor:'pointer' }} onClick={() => openDetail(task)}>
        <div style={{ width:3, borderRadius:2, flexShrink:0, alignSelf:'stretch', background: pc }}></div>
        <div className={`checkbox ${task.done ? 'checked' : ''}`} style={{ marginTop:2 }} onClick={(e) => { e.stopPropagation(); toggleTask(task) }}></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:3 }}>
            <span className="chip chip-label">{task.client_name}</span>
            <span className={`chip ${task.resp === 'Ellen Maximiano' ? 'chip-ellen' : 'chip-andrews'}`}>{task.resp}</span>
            <span className={`chip ${task.tipo === 'prev' ? 'chip-p' : task.tipo === 'contab' ? 'chip-c' : task.tipo === 'cliente' ? 'chip-g' : 'chip-i'}`}>{TIPO_LABEL[task.tipo] || task.tipo}</span>
            {task.sync_grouppo === 'contab' ? 'chip-c' : task.tipo === 'cliente' ? 'chip-g' : 'chip-i'}`}>{TIPO_LABEL[task.tipo] || task.tipo}</span>
            {task.sync_group && <span className="chip chip-s">Sync</span>}
          </div>
        </div>
      </div>
    )
  }

  function renderEditForm() {
    return (
      <>
        <div className="form-field"><label className="form-label">Descrição</label><input className="form-input" value={editForm.title} onChange={e => setEditForm(p => ({...p, title: e.target.value}))} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div className="form-field"><label className="form-label">Data</label><input className="form-input" type="date" value={editForm.date} onChange={e => setEditForm(p => ({...p, date: e.target.value}))} /></div>
          <div className="form-field"><label className="form-label">Horário</label><input className="form-input" type="time" /></div>
        </div>
        <div className="form-field"><label className="form-label">Cliente</label>
          <select className="form-input" value={editForm.clientId} onChange={e => setEditForm(p => ({...p, clientId: e.target.value}))}>
            <option value="">— Selecionar —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-field"><label className="form-label">Serviço</label><input className="form-input" placeholder="Ex: IRPF 2025, BPC LOAS..." value={editForm.service} onChange={e => setEditForm(p => ({...p, service: e.target.value}))} /></div>
        <div className="form-field"><label className="form-label">Área</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[['prev','Previdenciário','#E6F1FB','#0C447C','#85B7EB'],['contab','Contabilidade','#EEEDFE','#3C3489','#AFA9EC'],['assess','Cont. | Assessoria','#FAEEDA','#633806','#EF9F27']].map(([v,l,bg,cl,bc]) => (
              <div key={v} onClick={() => setEditForm(p => ({...p, area: v}))} style={{ padding:'7px 13px', border:`0.5px solid ${editForm.area === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: editForm.area === v ? bg : 'var(--bg-secondary)', color: editForm.area === v ? cl : 'var(--text-secondary)' }}>{l}</div>
            ))}
          </div>
        </div>
        <div className="form-field"><label className="form-label">Prioridade</label>
          <div style={{ display:'flex', gap:6 }}>
            {[['alta','Alta','#FCEBEB','#A32D2D','#F09595'],['media','Média','#FAEEDA','#633806','#EF9F27'],['baixa','Baixa','#EAF3DE','#27500A','#97C459']].map(([v,l,bg,cl,bc]) => (
              <div key={v} onClick={() => setEditForm(p => ({...p, priority: v}))} style={{ flex:1, padding:'8px 0', textAlign:'center', border:`0.5px solid ${editForm.priority === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: editForm.priority === v ? bg : 'var(--bg-secondary)', color: editForm.priority === v ? cl : 'var(--text-secondary)' }}>{l}</div>
            ))}
          </div>
        </div>
        <div className="form-field"><label className="form-label">Responsável</label>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {(['Ellen Maximiano','Andrews Maximiano'] as const).map(r => (
              <div key={r} onClick={() => setEditForm(p => ({...p, resp: r}))} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`0.5px solid ${editForm.resp === r ? 'var(--purple-400)' : 'var(--border-medium)'}`, borderRadius:'var(--radius-lg)', cursor:'pointer', background: editForm.resp === r ? 'var(--bg-primary)' : 'var(--bg-secondary)', position:'relative' }}>
                {editForm.resp === r && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:'3px 0 0 3px', background:'var(--purple-600)' }}></div>}
                <div className="avatar avatar-md" style={{ background: r === 'Ellen Maximiano' ? '#EEEDFE' : '#FAEEDA', color: r === 'Ellen Maximiano' ? '#3C3489' : '#633806' }}>{r === 'Ellen Maximiano' ? 'EM' : 'AM'}</div>
                <span style={{ fontSize:14, fontWeight:500, color: editForm.resp === r ? 'var(--purple-800)' : 'var(--text-primary)' }}>{r}</span>
                <div style={{ marginLeft:'auto', width:18, height:18, borderRadius:'50%', border:`1.5px solid ${editForm.resp === r ? 'var(--purple-600)' : 'var(--border-medium)'}`, background: editForm.resp === r ? 'var(--purple-600)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {editForm.resp === r && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--purple-50)' }}></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <button className={`btn ${selDay === TODAY ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelDay(TODAY)}>Hoje</button>
        <div style={{ position:'relative' }}>
          <button className={`btn btn-secondary ${selDay !== TODAY ? 'active' : ''}`} onClick={() => setShowCal(v => !v)}>
            📅 {selDay !== TODAY ? `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}` : 'Escolher data'}
          </button>
          {showCal && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, background:'var(--bg-primary)', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-xl)', overflow:'hidden', zIndex:200, width:280 }}>
              <div style={{ padding:'10px 14px', borderBottom:'0.5px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <button className="btn btn-icon btn-ghost" style={{ fontSize:13 }} onClick={() => { let m = tcpMonth - 1, y = tcpYear; if (m < 0) { m = 11; y-- } setTcpMonth(m); setTcpYear(y) }}>←</button>
                <span style={{ fontSize:13, fontWeight:500 }}>{MNS[tcpMonth]} {tcpYear}</span>
                <button className="btn btn-icon btn-ghost" style={{ fontSize:13 }} onClick={() => { let m = tcpMonth + 1, y = tcpYear; if (m > 11) { m = 0; y++ } setTcpMonth(m); setTcpYear(y) }}>→</button>
              </div>
              <div style={{ padding:'8px 10px 12px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
                  {DNS7.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:500, color:'var(--text-tertiary)', padding:'3px 0' }}>{d[0]}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                  {buildTcpDays().map((c, i) => (
                    <div key={i} onClick={() => { if (c.iso) { setSelDay(c.iso); setShowCal(false) } }} style={{ textAlign:'center', fontSize:12, padding:'6px 2px', borderRadius:'var(--radius-md)', cursor: c.iso ? 'pointer' : 'default', color: !c.iso ? 'var(--text-tertiary)' : c.iso === selDay ? 'var(--purple-50)' : c.iso === TODAY ? 'var(--purple-600)' : 'var(--text-primary)', background: c.iso === selDay ? 'var(--purple-600)' : 'transparent', border: c.iso === TODAY && c.iso !== selDay ? '0.5px solid var(--purple-200)' : '0.5px solid transparent', fontWeight: c.iso === TODAY ? 500 : 400 }}>
                      {c.d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <button className="btn btn-primary" style={{ marginLeft:'auto' }} onClick={() => setShowModal(true)}>+ Nova tarefa</button>
      </div>

      <div style={{ position:'relative', marginBottom:'1rem' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-tertiary)', pointerEvents:'none' }}>🔍</span>
        <input style={{ width:'100%', padding:'9px 12px 9px 32px', fontSize:13, border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-md)', background:'var(--bg-primary)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }} placeholder="Buscar tarefa ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>
        {selDay === TODAY ? 'Hoje — ' : ''}<span style={{ color:'var(--purple-600)' }}>{d.getDate()} de {MNS[d.getMonth()]} de {d.getFullYear()}</span>
      </div>

      <div style={{ display:'flex', gap:5, marginBottom:'1rem', flexWrap:'wrap' }}>
        {[['all','Todas'],['sync','Sincronizadas'],['Ellen Maximiano','Ellen'],['Andrews Maximiano','Andrews'],['prev','Previdenciário'],['contab','Contabilidade']].map(([v,l]) => (
          <button key={v} onClick={() => setFlt(v)} style={{ padding:'4px 10px', fontSize:11, fontWeight:500, border:'0.5px solid var(--border-medium)', borderRadius:20, cursor:'pointer', background: flt === v ? 'var(--bg-secondary)' : 'transparent', color: flt === v ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{l}</button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner"></div>Carregando...</div> : (
        <div>
          {pending.length > 0 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>Pendente ({pending.length})</div>
              <div className="card">{pending.map(renderTask)}</div>
            </div>
          )}
          {done.length > 0 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>Concluído ({done.length})</div>
              <div className="card">{done.map(renderTask)}</div>
            </div>
          )}
          {pending.length === 0 && done.length === 0 && (
            <div className="empty">{search ? 'Nenhuma tarefa encontrada.' : 'Nenhuma tarefa para este dia.'}</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">Nova tarefa</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-field"><label className="form-label">Descrição</label><input className="form-input" placeholder="Ex: Análise BPC..." value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div className="form-field"><label className="form-label">Data</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} /></div>
                <div className="form-field"><label className="form-label">Horário</label><input className="form-input" type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} /></div>
              </div>
              <div className="form-field"><label className="form-label">Cliente</label>
                <select className="form-input" value={form.clientId} onChange={e => setForm(p => ({...p, clientId: e.target.value}))}>
                  <option value="">— Selecionar —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-field"><label className="form-label">Serviço</label><input className="form-input" placeholder="Ex: IRPF 2025, BPC LOAS..." value={form.service} onChange={e => setForm(p => ({...p, service: e.target.value}))} /></div>
              <div className="form-field"><label className="form-label">Área</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[['prev','Previdenciário','#E6F1FB','#0C447C','#85B7EC'],['contab','Contabilidade','#EEEDFE','#3C3489','#AFA9EC'],['assess','Cont. | Assessoria','#FAEEDA','#633806','#EF9F27']].map(([v,l,bg,cl,bc]) => (
                    <div key={v} onClick={() => setForm(p => ({...p, area: v}))} style={{ padding:'7px 13px', border:`0.5px solid ${form.area === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: form.area === v ? bg : 'var(--bg-secondary)', color: form.area === v ? cl : 'var(--text-secondary)' }}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="form-field"><label className="form-label">Prioridade</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['alta','Alta','#FCEBEB','#A32D2D','#F09595'],['media','Média','#FAEEDA','#633806','#EF9F27'],['baixa','Baixa','#EAF3DE','#27500A','#97C459']].map(([v,l,bg,cl,bc]) => (
                    <div key={v} onClick={() => setForm(p => ({...p, priority: v}))} style={{ flex:1, padding:'8px 0', textAlign:'center', border:`0.5px solid ${form.priority === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: form.priority === v ? bg : 'var(--bg-secondary)', color: form.priority === v ? cl : 'var(--text-secondary)' }}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="form-field"><label className="form-label">Responsável</label>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {(['Ellen Maximiano','Andrews Maximiano'] as const).map(r => (
                    <div key={r} onClick={() => setForm(p => ({...p, resp: r}))} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`0.5px solid ${form.resp === r ? 'var(--purple-400)' : 'var(--border-medium)'}`, borderRadius:'var(--radius-lg)', cursor:'pointer', background: form.resp === r ? 'var(--bg-primary)' : 'var(--bg-secondary)', position:'relative' }}>
                      {form.resp === r && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:'3px 0 0 3px', background:'var(--purple-600)' }}></div>}
                      <div className="avatar avatar-md" style={{ background: r === 'Ellen Maximiano' ? '#EEEDFE' : '#FAEEDA', color: r === 'Ellen Maximiano' ? '#3C3489' : '#633806' }}>{r === 'Ellen Maximiano' ? 'EM' : 'AM'}</div>
                      <span style={{ fontSize:14, fontWeight:500, color: form.resp === r ? 'var(--purple-800)' : 'var(--text-primary)' }}>{r}</span>
                      <div style={{ marginLeft:'auto', width:18, height:18, borderRadius:'50%', border:`1.5px solid ${form.resp === r ? 'var(--purple-600)' : 'var(--border-medium)'}`, background: form.resp === r ? 'var(--purple-600)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {form.resp === r && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--purple-50)' }}></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTask}>Criar tarefa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhe / Editar Tarefa */}
      {detailTask && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setDetailTask(null); setEditMode(false); setConfirmDelete(false) } }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">{editMode ? 'Editar tarefa' : 'Detalhes da tarefa'}</div>
              <button className="btn btn-icon btn-ghost" onClick={() => { setDetailTask(null); setEditMode(false); setConfirmDelete(false) }}>✕</button>
            </div>
            <div className="modal-body">
              {editMode ? renderEditForm() : (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Tarefa</div>
                    <div style={{ fontSize:15, fontWeight:500 }}>{detailTask.title}</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Status</div>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:500, background: detailTask.done ? '#EAF3DE' : '#FFF8E6', color: detailTask.done ? '#27500A' : '#633806' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background: detailTask.done ? '#639922' : '#EF9F27' }}></div>
                        {detailTask.done ? 'Concluída' : 'Pendente'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Data</div>
                      <div style={{ fontSize:13 }}>{(() => { const dt = new Date(detailTask.date + 'T12:00'); return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()}` })()}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Cliente</div>
                      <div style={{ fontSize:13 }}>{detailTask.client_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Serviço</div>
                      <div style={{ fontSize:13 }}>{detailTask.service}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Área</div>
                      <span className={`chip ${detailTask.tipo === 'prev' ? 'chip-p' : detailTask.tipo === 'contab' ? 'chip-c' : detailTask.tipo === 'cliente' ? 'chip-g' : 'chip-i'}`}>{AREA_LABEL[detailTask.tipo] || detailTask.tipo}</span>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Prioridade</div>
                      <div style={{ display:'inline-flex', padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:500, background: detailTask.priority === 'alta' ? '#FCEBEB' : detailTask.priority === 'media' ? '#FAEEDA' : '#EAF3DE', color: detailTask.priority === 'alta' ? '#A32D2D' : detailTask.priority === 'media' ? '#633806' : '#27500A' }}>{PRIO_LABEL[detailTask.priority] || detailTask.priority}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Responsável</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="avatar avatar-md" style={{ background: detailTask.resp === 'Ellen Maximiano' ? '#EEEDFE' : '#FAEEDA', color: detailTask.resp === 'Ellen Maximiano' ? '#3C3489' : '#633806' }}>{detailTask.resp === 'Ellen Maximiano' ? 'EM' : 'AM'}</div>
                      <span style={{ fontSize:13, fontWeight:500 }}>{detailTask.resp}</span>
                    </div>
                  </div>
                  {detailTask.sync_group && (
                    <div style={{ padding:'8px 12px', background:'var(--bg-secondary)', borderRadius:'var(--radius-md)', fontSize:12, color:'var(--text-secondary)' }}>
                      Tarefa sincronizada (grupo: {detailTask.sync_group.substring(0,8)}...)
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: editMode ? 'flex-end' : 'space-between' }}>
              {!editMode ? (
                <>
                  <div style={{ display:'flex', gap:6 }}>
                    {!confirmDelete ? (
                      <button className="btn btn-secondary" style={{ color:'#A32D2D', borderColor:'#F09595' }} onClick={() => setConfirmDelete(true)}>Excluir</button>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:12, color:'#A32D2D' }}>Confirmar?</span>
                        <button className="btn btn-secondary" style={{ background:'#FCEBEB', color:'#A32D2D', borderColor:'#F09595', fontSize:12, padding:'6px 12px' }} onClick={handleDelete}>Sim, excluir</button>
                        <button className="btn btn-secondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setConfirmDelete(false)}>Não</button>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={() => setEditMode(true)}>Editar</button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveEdit}>Salvar alterações</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
