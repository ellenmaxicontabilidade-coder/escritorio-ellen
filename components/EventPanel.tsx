'use client'
import { useState, useEffect } from 'react'
import { getSubtasksByDate, updateSubtask, deleteSubtask, createComment, getCommentsBySubtask } from '@/lib/db'
import { MNS, DLONG, nowStr, ini } from '@/lib/utils'
import type { Subtask, Comment } from '@/lib/types'

interface Props {
  date: string
  clientId: string
  onClose: () => void
  showToast: (msg: string, type?: 'success' | 'danger') => void
  onRefresh: () => void
}

export default function EventPanel({ date, clientId, onClose, showToast, onRefresh }: Props) {
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [clientInfo, setClientInfo] = useState<any>(null)

  useEffect(() => {
    load()
  }, [date, clientId])

  async function load() {
    setLoading(true)
    try {
      const all = await getSubtasksByDate(date)
      const filtered = all.filter((s: any) => s.service?.client_id === clientId)
      setSubs(filtered)
      if (filtered[0]?.service?.clients) setClientInfo(filtered[0].service.clients)
      const cmtMap: Record<string, Comment[]> = {}
      await Promise.all(filtered.map(async (s: any) => {
        cmtMap[s.id] = await getCommentsBySubtask(s.id)
      }))
      setComments(cmtMap)
    } finally { setLoading(false) }
  }

  async function toggleDone(sub: any) {
    await updateSubtask(sub.id, { done: !sub.done })
    showToast(!sub.done ? 'Tarefa concluída!' : 'Tarefa reaberta.')
    load(); onRefresh()
  }

  async function saveSub(id: string) {
    await updateSubtask(id, editForm)
    setEditingId(null)
    showToast('Subtarefa atualizada!')
    load(); onRefresh()
  }

  async function removeSub(id: string) {
    await deleteSubtask(id)
    showToast('Subtarefa excluída.', 'danger')
    load(); onRefresh()
  }

  async function sendComment(subId: string) {
    const txt = (newComment[subId] || '').trim()
    if (!txt) return
    await createComment({
      subtask_id: subId,
      author: 'Ellen Maximiano',
      av: 'ave',
      init: 'EM',
      text: txt,
      dt: nowStr()
    })
    setNewComment(p => ({ ...p, [subId]: '' }))
    load()
  }

  const d = new Date(date + 'T12:00')
  const dateStr = `${DLONG[d.getDay()]}, ${d.getDate()} de ${MNS[d.getMonth()]} de ${d.getFullYear()}`
  const clientName = clientInfo?.name || 'Cliente'

  return (
    <div style={{ marginTop:'1rem', background:'var(--bg-primary)', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-xl)', overflow:'hidden' }}>
      <div style={{ padding:'1.25rem 1.5rem 1rem', borderBottom:'0.5px solid var(--border-light)', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div className="avatar avatar-md" style={{ background: clientInfo?.av_bg || '#EEEDFE', color: clientInfo?.av_cl || '#3C3489' }}>
          {ini(clientName)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:500 }}>{clientName}</div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{dateStr}</div>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding:'1.25rem 1.5rem' }}>
        {loading ? <div className="loading"><div className="spinner"></div>Carregando...</div> : subs.length === 0
          ? <div className="empty">Nenhuma tarefa neste dia para este cliente.</div>
          : subs.reduce((acc: any[], sub: any) => {
              const svcId = sub.service_id
              let grp = acc.find(g => g.svcId === svcId)
              if (!grp) { grp = { svcId, svc: sub.service, subs: [] }; acc.push(grp) }
              grp.subs.push(sub)
              return acc
            }, []).map((grp: any) => {
              const tipo = grp.svc?.tipo || 'interno'
              const tipoCls: Record<string, string> = { prev:'#185FA5', contab:'#534AB7', assessoria:'#BA7517', cliente:'#3B6D11', interno:'#888780' }
              const tipoBg: Record<string, string> = { prev:'#E6F1FB', contab:'#EEEDFE', assessoria:'#FAEEDA', cliente:'#EAF3DE', interno:'var(--bg-secondary)' }
              const tipoLabel: Record<string, string> = { prev:'Previdenciário', contab:'Contabilidade', assessoria:'Cont. | Assessoria', cliente:'Entrega Cliente', interno:'Interno' }
              return (
                <div key={grp.svcId} style={{ border:'0.5px solid var(--border-light)', borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom:12 }}>
                  <div style={{ padding:'.75rem 1rem', background:'var(--bg-secondary)', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{grp.svc?.nome}</div>
                      {grp.svc?.orig && <div style={{ fontSize:10, color:'var(--text-secondary)' }}>Origem: {grp.svc.orig}</div>}
                    </div>
                    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:500, background: tipoBg[tipo], color: tipoCls[tipo] }}>{tipoLabel[tipo]}</span>
                  </div>
                  {grp.subs.map((sub: any) => {
                    const isEditing = editingId === sub.id
                    const cms = comments[sub.id] || []
                    const isE = sub.resp === 'Ellen Maximiano'
                    return (
                      <div key={sub.id} style={{ borderTop:'0.5px solid var(--border-light)' }}>
                        <div style={{ padding:'.875rem 1rem' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                            <div className={`checkbox ${sub.done ? 'checked' : ''}`} onClick={() => toggleDone(sub)} style={{ marginTop:2 }}></div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, textDecoration: sub.done ? 'line-through' : 'none', color: sub.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{sub.title}</div>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
                                <span className={`chip ${isE ? 'chip-ellen' : 'chip-andrews'}`}>{sub.resp}</span>
                                {sub.time && <span className="chip" style={{ background:'var(--amber-50)', color:'var(--amber-800)' }}>às {sub.time}h</span>}
                                {cms.length > 0 && <span className="chip chip-label">{cms.length} comentário{cms.length > 1 ? 's' : ''}</span>}
                              </div>
                              <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                                {!sub.done
                                  ? <button className="btn btn-success btn-sm" onClick={() => toggleDone(sub)}>✓ Concluir</button>
                                  : <button className="btn btn-warning btn-sm" onClick={() => toggleDone(sub)}>↩ Reabrir</button>
                                }
                                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(isEditing ? null : sub.id); setEditForm({ title: sub.title, date: sub.date, time: sub.time, resp: sub.resp }) }}>✏ Editar</button>
                                <button className="btn btn-danger btn-sm" onClick={() => removeSub(sub.id)}>✕ Excluir</button>
                              </div>

                              {isEditing && (
                                <div style={{ marginTop:10, padding:12, background:'var(--bg-secondary)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border-medium)' }}>
                                  <div className="form-field">
                                    <label className="form-label">Descrição</label>
                                    <input className="form-input" value={editForm.title || ''} onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))} />
                                  </div>
                                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                                    <div>
                                      <label className="form-label">Data</label>
                                      <input className="form-input" type="date" value={editForm.date || ''} onChange={e => setEditForm((p: any) => ({ ...p, date: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label className="form-label">Horário</label>
                                      <input className="form-input" type="time" value={editForm.time || ''} onChange={e => setEditForm((p: any) => ({ ...p, time: e.target.value }))} />
                                    </div>
                                  </div>
                                  <div style={{ marginBottom:10 }}>
                                    <label className="form-label">Responsável</label>
                                    <div style={{ display:'flex', gap:6 }}>
                                      {(['Ellen Maximiano','Andrews Maximiano'] as const).map(r => (
                                        <div key={r} onClick={() => setEditForm((p: any) => ({ ...p, resp: r }))} style={{ flex:1, display:'flex', alignItems:'center', gap:6, padding:'7px 9px', border:`0.5px solid ${editForm.resp === r ? 'var(--purple-400)' : 'var(--border-medium)'}`, borderRadius:'var(--radius-md)', cursor:'pointer', background: editForm.resp === r ? 'var(--purple-50)' : 'var(--bg-primary)' }}>
                                          <div className="avatar avatar-sm" style={{ background: r === 'Ellen Maximiano' ? '#EEEDFE' : '#FAEEDA', color: r === 'Ellen Maximiano' ? '#3C3489' : '#633806' }}>{r === 'Ellen Maximiano' ? 'EM' : 'AM'}</div>
                                          <span style={{ fontSize:11, color: editForm.resp === r ? 'var(--purple-800)' : 'var(--text-primary)', fontWeight: editForm.resp === r ? 500 : 400 }}>{r === 'Ellen Maximiano' ? 'Ellen' : 'Andrews'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => saveSub(sub.id)}>Salvar</button>
                                  </div>
                                </div>
                              )}

                              {cms.length > 0 && (
                                <div style={{ marginTop:10 }}>
                                  {cms.map(cm => (
                                    <div key={cm.id} style={{ display:'flex', gap:8, marginBottom:8 }}>
                                      <div className="avatar avatar-sm" style={{ background: cm.av === 'ave' ? '#EEEDFE' : '#FAEEDA', color: cm.av === 'ave' ? '#3C3489' : '#633806', marginTop:1 }}>{cm.init}</div>
                                      <div style={{ flex:1, background:'var(--bg-secondary)', borderRadius:'0 var(--radius-md) var(--radius-md) var(--radius-md)', padding:'6px 9px' }}>
                                        <div style={{ fontSize:10, fontWeight:500, color:'var(--text-secondary)' }}>{cm.author} · {cm.dt}</div>
                                        <div style={{ fontSize:12, marginTop:2, lineHeight:1.5 }}>{cm.text}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                                <div style={{ flex:1, display:'flex', alignItems:'center', border:'0.5px solid var(--border-medium)', borderRadius:'var(--radius-md)', background:'var(--bg-primary)', overflow:'hidden' }}>
                                  <input style={{ flex:1, padding:'7px 9px', fontSize:12, border:'none', background:'transparent', outline:'none', fontFamily:'inherit', color:'var(--text-primary)' }} placeholder="Adicionar comentário..." value={newComment[sub.id] || ''} onChange={e => setNewComment(p => ({ ...p, [sub.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') sendComment(sub.id) }} />
                                  <button style={{ padding:'6px 11px', fontSize:11, fontWeight:500, border:'none', borderLeft:'0.5px solid var(--border-light)', background:'transparent', color:'var(--purple-600)', cursor:'pointer', fontFamily:'inherit' }} onClick={() => sendComment(sub.id)}>Enviar</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
        }
      </div>
    </div>
  )
                                  }
