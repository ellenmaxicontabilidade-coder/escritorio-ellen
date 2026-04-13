'use client'
import { useState, useEffect } from 'react'
import { getServicesByClient, getSubtasksByService, getCommentsBySubtask, updateSubtask, createComment, createSubtask, getVinculos } from '@/lib/db'
import { ini, fmtDate, TIPO_LABEL, nowStr } from '@/lib/utils'
import type { Client, Service, Subtask, Comment, Vinculo } from '@/lib/types'

interface Props {
  client: Client
  onEdit: () => void
  onDelete: () => void
  showToast: (msg: string, type?: 'success' | 'danger') => void
}

export default function ClientPanel({ client, onEdit, onDelete, showToast }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [loading, setLoading] = useState(true)
  const [openSvc, setOpenSvc] = useState<string[]>([])
  const [openCmt, setOpenCmt] = useState<string[]>([])
  const [showDotsMenu, setShowDotsMenu] = useState(false)
  const [addFormSvc, setAddFormSvc] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ title:'', date:'', time:'', resp:'Ellen Maximiano', obs:'' })
  const [newComment, setNewComment] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [client.id])

  async function load() {
    setLoading(true)
    try {
      const svs = await getServicesByClient(client.id)
      setServices(svs)
      const subs: Record<string, Subtask[]> = {}
      const cmts: Record<string, Comment[]> = {}
      await Promise.all(svs.map(async sv => {
        subs[sv.id] = await getSubtasksByService(sv.id)
        await Promise.all(subs[sv.id].map(async s => {
          cmts[s.id] = await getCommentsBySubtask(s.id)
        }))
      }))
      setSubtasks(subs)
      setComments(cmts)
      setVinculos(await getVinculos(client.id))
    } finally { setLoading(false) }
  }

  async function toggleSub(sub: Subtask) {
    await updateSubtask(sub.id, { done: !sub.done })
    showToast(!sub.done ? 'Concluída!' : 'Reaberta.')
    load()
  }

  async function sendComment(subId: string) {
    const txt = (newComment[subId] || '').trim()
    if (!txt) return
    await createComment({ subtask_id: subId, author: 'Ellen Maximiano', av: 'ave', init: 'EM', text: txt, dt: nowStr() })
    setNewComment(p => ({ ...p, [subId]: '' }))
    load()
  }

  async function saveSubtask(svId: string) {
    if (!addForm.title.trim()) return
    await createSubtask({ service_id: svId, title: addForm.title, done: false, resp: addForm.resp as any, date: addForm.date || undefined, time: addForm.time || undefined })
    if (addForm.obs.trim()) {
      const newSubs = await getSubtasksByService(svId)
      const last = newSubs[newSubs.length - 1]
      if (last) await createComment({ subtask_id: last.id, author: addForm.resp, av: addForm.resp === 'Ellen Maximiano' ? 'ave' : 'ava', init: addForm.resp === 'Ellen Maximiano' ? 'EM' : 'AM', text: addForm.obs, dt: nowStr() })
    }
    setAddFormSvc(null)
    setAddForm({ title:'', date:'', time:'', resp:'Ellen Maximiano', obs:'' })
    showToast('Subtarefa adicionada!')
    load()
  }

  const pending = Object.values(subtasks).flat().filter(s => !s.done).length
  const done = Object.values(subtasks).flat().filter(s => s.done).length

  const tipoBg: Record<string, string> = { prev:'#E6F1FB', contab:'#EEEDFE', assessoria:'#FAEEDA', cliente:'#EAF3DE', interno:'var(--bg-secondary)' }
  const tipoCl: Record<string, string> = { prev:'#185FA5', contab:'#534AB7', assessoria:'#BA7517', cliente:'#3B6D11', interno:'var(--text-secondary)' }
  const tipoIco: Record<string, string> = { prev:'ico-p', contab:'ico-c', assessoria:'ico-c', cliente:'ico-g' }

  return (
    <div className="card" style={{ height:'fit-content' }}>
      <div style={{ padding:'1rem 1.25rem', borderBottom:'0.5px solid var(--border-light)', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div className="avatar avatar-lg" style={{ background: client.av_bg, color: client.av_cl }}>{ini(client.name)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:500 }}>{client.name}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2, display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
            <span>{client.meta}</span>
            {client.badges.map(b => <span key={b} className={`badge badge-${b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : 'rep'}`}>{b}</span>)}
          </div>
        </div>
        <div style={{ position:'relative', flexShrink:0 }}>
          <button className="btn btn-icon btn-ghost" onClick={() => setShowDotsMenu(v => !v)}>⋯</button>
          {showDotsMenu && (
            <div style={{ position:'absolute', top:'calc(100% + 5px)', right:0, background:'var(--bg-primary)', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-lg)', overflow:'hidden', zIndex:200, minWidth:160 }}>
              <div onClick={() => { setShowDotsMenu(false); onEdit() }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'0.5px solid var(--border-light)' }} className="dd-hover">✏ Editar cliente</div>
              <div onClick={() => { setShowDotsMenu(false); onDelete() }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', fontSize:13, color:'var(--red-600)' }}>✕ Excluir cliente</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', borderBottom:'0.5px solid var(--border-light)' }}>
        {[['Pendentes', pending, pending > 0 ? 'var(--amber-600)' : ''],['Concluídas', done, done > 0 ? 'var(--green-600)' : ''],['Serviços', services.length, '']].map(([l,v,c]) => (
          <div key={l as string} style={{ padding:'.8rem 1rem', textAlign:'center', borderRight:'0.5px solid var(--border-light)' }}>
            <div style={{ fontSize:20, fontWeight:500, color: (c as string) || 'var(--text-primary)' }}>{v as number}</div>
            <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {vinculos.map(v => {
        const lc = v.linked_client as any
        if (!lc) return null
        const relStr = (v.rels || []).join(' · ') || 'Vínculo'
        return (
          <div key={v.id} style={{ padding:'.7rem 1.25rem', borderBottom:'0.5px solid var(--border-light)', display:'flex', alignItems:'center', gap:10 }}>
            <div className="avatar avatar-sm" style={{ background: lc.av_bg, color: lc.av_cl }}>{ini(lc.name)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{lc.name}</div>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{relStr}</div>
            </div>
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'var(--purple-50)', color:'var(--purple-600)', fontWeight:500 }}>Sync</span>
          </div>
        )
      })}

      <div style={{ padding:'1rem 1.25rem' }}>
        {client.obs && (
          <div style={{ marginBottom:'1.25rem' }}>
            <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Observações</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', background:'var(--bg-secondary)', borderRadius:'var(--radius-md)', padding:'8px 10px', lineHeight:1.7 }}>{client.obs}</div>
          </div>
        )}

        <div style={{ fontSize:10, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Serviços e tarefas</div>

        {loading ? <div className="loading"><div className="spinner"></div></div>
          : services.length === 0 ? <div className="empty">Nenhum serviço cadastrado.</div>
          : services.map(sv => {
            const sbs = subtasks[sv.id] || []
            const sp = sbs.filter(s => !s.done).length
            const tipo = sv.tipo || 'interno'
            return (
              <div key={sv.id} style={{ border:'0.5px solid var(--border-light)', borderRadius:'var(--radius-lg)', marginBottom:10, overflow:'hidden' }}>
                <div onClick={() => setOpenSvc(p => p.includes(sv.id) ? p.filter(x => x !== sv.id) : [...p, sv.id])} style={{ padding:'.75rem 1rem', display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:'var(--bg-primary)' }}>
                  <div style={{ width:30, height:30, borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: tipoBg[tipo] }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke={tipoCl[tipo]} strokeWidth="1.2"/><path d="M5 7h6M5 10h4" stroke={tipoCl[tipo]} strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{sv.nome}</div>
                    {sv.orig && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:1 }}>{sv.orig}</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:500, padding:'2px 7px', borderRadius:10, background: sp > 0 ? 'var(--amber-50)' : 'var(--bg-secondary)', color: sp > 0 ? 'var(--amber-800)' : 'var(--text-tertiary)' }}>{sp > 0 ? `${sp} pend.` : '0 pend.'}</span>
                  <span style={{ fontSize:12, color:'var(--text-tertiary)', transition:'transform .2s', transform: openSvc.includes(sv.id) ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
                </div>

                {openSvc.includes(sv.id) && (
                  <div style={{ borderTop:'0.5px solid var(--border-light)' }}>
                    {sbs.map(sub => {
                      const cms = comments[sub.id] || []
                      const dt = fmtDate(sub.date, sub.time)
                      const isE = sub.resp === 'Ellen Maximiano'
                      const accColor = sub.done ? '#639922' : isE ? '#E24B4A' : '#EF9F27'
                      const open = openCmt.includes(sub.id)
                      return (
                        <div key={sub.id} style={{ borderBottom:'0.5px solid var(--border-light)' }}>
                          <div onClick={() => setOpenCmt(p => p.includes(sub.id) ? p.filter(x => x !== sub.id) : [...p, sub.id])} style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'.75rem 1rem', cursor:'pointer', opacity: sub.done ? 0.5 : 1 }}>
                            <div style={{ width:2, borderRadius:2, flexShrink:0, alignSelf:'stretch', background: accColor }}></div>
                            <div className={`checkbox ${sub.done ? 'checked' : ''}`} style={{ marginTop:1 }} onClick={e => { e.stopPropagation(); toggleSub(sub) }}></div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, textDecoration: sub.done ? 'line-through' : 'none' }}>{sub.title}</div>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5, alignItems:'center' }}>
                                {dt && <span className="chip" style={{ background:'var(--amber-50)', color:'var(--amber-800)' }}>📅 {dt}</span>}
                                <span className={`chip ${isE ? 'chip-ellen' : 'chip-andrews'}`}>{sub.resp}</span>
                                {sub.sync_group && <span className="chip chip-s">Sync</span>}
                                {cms.length > 0 && <span className="chip chip-label">💬 {cms.length}</span>}
                              </div>
                            </div>
                            <span style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2, flexShrink:0 }}>⌄</span>
                          </div>
                          {open && (
                            <div style={{ background:'var(--bg-secondary)', borderTop:'0.5px solid var(--border-light)', padding:'.75rem 1rem' }}>
                              {cms.map(cm => (
                                <div key={cm.id} style={{ display:'flex', gap:8, marginBottom:9 }}>
                                  <div className="avatar avatar-sm" style={{ background: cm.av === 'ave' ? '#EEEDFE' : '#FAEEDA', color: cm.av === 'ave' ? '#3C3489' : '#633806', marginTop:1 }}>{cm.init}</div>
                                  <div style={{ flex:1, background:'var(--bg-primary)', border:'0.5px solid var(--border-light)', borderRadius:'0 var(--radius-md) var(--radius-md) var(--radius-md)', padding:'6px 9px' }}>
                                    <div style={{ fontSize:10, fontWeight:500, color:'var(--text-secondary)' }}>{cm.author}</div>
                                    <div style={{ fontSize:12, marginTop:2, lineHeight:1.5 }}>{cm.text}</div>
                                    <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>{cm.dt}</div>
                                  </div>
                                </div>
                              ))}
                              <div style={{ height:'0.5px', background:'var(--border-light)', margin:'8px 0' }}></div>
                              <div style={{ display:'flex', gap:6 }}>
                                <div style={{ flex:1, display:'flex', alignItems:'center', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-md)', background:'var(--bg-primary)', overflow:'hidden' }}>
                                  <input style={{ flex:1, padding:'7px 9px', fontSize:12, border:'none', background:'transparent', outline:'none', fontFamily:'inherit', color:'var(--text-primary)' }} placeholder="Comentário..." value={newComment[sub.id] || ''} onChange={e => setNewComment(p => ({...p, [sub.id]: e.target.value}))} onKeyDown={e => { if (e.key === 'Enter') sendComment(sub.id) }} />
                                  <button style={{ padding:'6px 11px', fontSize:11, fontWeight:500, border:'none', borderLeft:'0.5px solid var(--border-light)', background:'transparent', color:'var(--purple-600)', cursor:'pointer', fontFamily:'inherit' }} onClick={() => sendComment(sub.id)}>Enviar</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div onClick={() => setAddFormSvc(addFormSvc === sv.id ? null : sv.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'.75rem 1rem', borderTop:'0.5px solid var(--border-light)', cursor:'pointer', color:'var(--text-tertiary)', fontSize:12 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', border:'1.5px solid var(--border-medium)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, lineHeight:1 }}>+</div>
                      Adicionar subtarefa
                    </div>
                    {addFormSvc === sv.id && (
                      <div style={{ borderTop:'0.5px solid var(--border-light)', padding:'1rem', background:'var(--bg-secondary)' }}>
                        <div style={{ marginBottom:9 }}><label className="form-label">Descrição</label><input className="form-input" placeholder="Ex: Pegar documentos..." value={addForm.title} onChange={e => setAddForm(p => ({...p, title: e.target.value}))} /></div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:9 }}>
                          <div><label className="form-label">Data</label><input className="form-input" type="date" value={addForm.date} onChange={e => setAddForm(p => ({...p, date: e.target.value}))} /></div>
                          <div><label className="form-label">Horário</label><input className="form-input" type="time" value={addForm.time} onChange={e => setAddForm(p => ({...p, time: e.target.value}))} /></div>
                        </div>
                        <div style={{ marginBottom:9 }}><label className="form-label">Responsável</label>
                          <div style={{ display:'flex', gap:6 }}>
                            {(['Ellen Maximiano','Andrews Maximiano'] as const).map(r => (
                              <div key={r} onClick={() => setAddForm(p => ({...p, resp: r}))} style={{ flex:1, display:'flex', alignItems:'center', gap:6, padding:'7px 9px', border:`0.5px solid ${addForm.resp === r ? 'var(--purple-400)' : 'var(--border-medium)'}`, borderRadius:'var(--radius-md)', cursor:'pointer', background: addForm.resp === r ? 'var(--purple-50)' : 'var(--bg-primary)' }}>
                                <div className="avatar avatar-sm" style={{ background: r === 'Ellen Maximiano' ? '#EEEDFE' : '#FAEEDA', color: r === 'Ellen Maximiano' ? '#3C3489' : '#633806' }}>{r === 'Ellen Maximiano' ? 'EM' : 'AM'}</div>
                                <span style={{ fontSize:11, color: addForm.resp === r ? 'var(--purple-800)' : 'var(--text-primary)', fontWeight: addForm.resp === r ? 500 : 400 }}>{r === 'Ellen Maximiano' ? 'Ellen' : 'Andrews'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom:9 }}><label className="form-label">Observação inicial</label><textarea className="form-input form-textarea" placeholder="Ex: Aguardando retorno..." value={addForm.obs} onChange={e => setAddForm(p => ({...p, obs: e.target.value}))} /></div>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAddFormSvc(null)}>Cancelar</button>
                          <button className="btn btn-primary btn-sm" onClick={() => saveSubtask(sv.id)}>Salvar subtarefa</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
                                }
