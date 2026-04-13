'use client'
import { useState, useEffect, useCallback } from 'react'
import { getTasksByDate, createTask, updateTask } from '@/lib/db'
import { getClients } from '@/lib/db'
import { MNS, DLONG, toISO, pad, TIPO_LABEL, chipResp } from '@/lib/utils'
import type { Task, Client } from '@/lib/types'

const TODAY = toISO(new Date())
const DNS7 = ['Dom','Seg','Ter','Qua','Qui','Sex','SÃ¡b']

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
      client_name: cli?.name || 'â',
      client_id: form.clientId || undefined,
      service: form.service || 'â',
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
    ? `Hoje â ${d.getDate()} de ${MNS[d.getMonth()]} de ${d.getFullYear()}`
    : `${DLONG[d.getDay()]}, ${d.getDate()} de ${MNS[d.getMonth()]} de ${d.getFullYear()}`

  function renderTask(task: Task) {
    const pc = task.priority === 'alta' ? '#E24B4A' : task.priority === 'media' ? '#EF9F27' : '#639922'
    return (
      <div key={task.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border-light)', opacity: task.done ? 0.45 : 1 }}>
        <div style={{ width:3, borderRadius:2, flexShrink:0, alignSelf:'stretch', background: pc }}></div>
        <div className={`checkbox ${task.done ? 'checked' : ''}`} style={{ marginTop:2 }} onClick={() => toggleTask(task)}></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:3 }}>
            <span className="chip chip-label">{task.client_name}</span>
            <span className={`chip ${task.resp === 'Ellen Maximiano' ? 'chip-ellen' : 'chip-andrews'}`}>{task.resp}</span>
            <span className={`chip ${task.tipo === 'prev' ? 'chip-p' : task.tipo === 'contab' ? 'chip-c' : task.tipo === 'cliente' ? 'chip-g' : 'chip-i'}`}>{TIPO_LABEL[task.tipo] || task.tipo}</span>
            {task.sync_group && <span className="chip chip-s">Sync</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <button className={`btn ${selDay === TODAY ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelDay(TODAY)}>Hoje</button>
        <div style={{ position:'relative' }}>
          <button className={`btn btn-secondary ${selDay !== TODAY ? 'active' : ''}`} onClick={() => setShowCal(v => !v)}>
            ð {selDay !== TODAY ? `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}` : 'Escolher data'}
          </button>
          {showCal && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, background:'var(--bg-primary)', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-xl)', overflow:'hidden', zIndex:200, width:280 }}>
              <div style={{ padding:'10px 14px', borderBottom:'0.5px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <button className="btn btn-icon btn-ghost" style={{ fontSize:13 }} onClick={() => { let m = tcpMonth - 1, y = tcpYear; if (m < 0) { m = 11; y-- } setTcpMonth(m); setTcpYear(y) }}>â</button>
                <span style={{ fontSize:13, fontWeight:500 }}>{MNS[tcpMonth]} {tcpYear}</span>
                <button className="btn btn-icon btn-ghost" style={{ fontSize:13 }} onClick={() => { let m = tcpMonth + 1, y = tcpYear; if (m > 11) { m = 0; y++ } setTcpMonth(m); setTcpYear(y) }}>â</button>
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
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-tertiary)', pointerEvents:'none' }}>ð</span>
        <input style={{ width:'100%', padding:'9px 12px 9px 32px', fontSize:13, border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-md)', background:'var(--bg-primary)', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }} placeholder="Buscar tarefa ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>
        {selDay === TODAY ? 'Hoje â ' : ''}<span style={{ color:'var(--purple-600)' }}>{d.getDate()} de {MNS[d.getMonth()]} de {d.getFullYear()}</span>
      </div>

      <div style={{ display:'flex', gap:5, marginBottom:'1rem', flexWrap:'wrap' }}>
        {[['all','Todas'],['sync','Sincronizadas'],['Ellen Maximiano','Ellen'],['Andrews Maximiano','Andrews'],['prev','PrevidenciÃ¡rio'],['contab','Contabilidade']].map(([v,l]) => (
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
              <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>ConcluÃ­do ({done.length})</div>
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
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>â</button>
            </div>
            <div className="modal-body">
              <div className="form-field"><label className="form-label">DescriÃ§Ã£o</label><input className="form-input" placeholder="Ex: AnÃ¡lise BPC..." value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div className="form-field"><label className="form-label">Data</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} /></div>
                <div className="form-field"><label className="form-label">HorÃ¡rio</label><input className="form-input" type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} /></div>
              </div>
              <div className="form-field"><label className="form-label">Cliente</label>
                <select className="form-input" value={form.clientId} onChange={e => setForm(p => ({...p, clientId: e.target.value}))}>
                  <option value="">â Selecionar â</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-field"><label className="form-label">ServiÃ§o</label><input className="form-input" placeholder="Ex: IRPF 2025, BPC LOAS..." value={form.service} onChange={e => setForm(p => ({...p, service: e.target.value}))} /></div>
              <div className="form-field"><label className="form-label">Ãrea</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[['prev','PrevidenciÃ¡rio','#E6F1FB','#0C447C','#85B7EB'],['contab','Contabilidade','#EEEDFE','#3C3489','#AFA9EC'],['assess','Cont. | Assessoria','#FAEEDA','#633806','#EF9F27']].map(([v,l,bg,cl,bc]) => (
                    <div key={v} onClick={() => setForm(p => ({...p, area: v}))} style={{ padding:'7px 13px', border:`0.5px solid ${form.area === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: form.area === v ? bg : 'var(--bg-secondary)', color: form.area === v ? cl : 'var(--text-secondary)' }}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="form-field"><label className="form-label">Prioridade</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['alta','Alta','#FCEBEB','#A32D2D','#F09595'],['media','MÃ©dia','#FAEEDA','#633806','#EF9F27'],['baixa','Baixa','#EAF3DE','#27500A','#97C459']].map(([v,l,bg,cl,bc]) => (
                    <div key={v} onClick={() => setForm(p => ({...p, priority: v}))} style={{ flex:1, padding:'8px 0', textAlign:'center', border:`0.5px solid ${form.priority === v ? bc : 'var(--border-medium)'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, background: form.priority === v ? bg : 'var(--bg-secondary)', color: form.priority === v ? cl : 'var(--text-secondary)' }}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="form-field"><label className="form-label">ResponsÃ¡vel</label>
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
    </div>
  )
}

function tipoCls(tipo: string) {
  return { contab:'chip-c', assessoria:'chip-a', prev:'chip-p', cliente:'chip-g', interno:'chip-i' }[tipo] || 'chip-i'
}
