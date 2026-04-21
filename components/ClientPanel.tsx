'use client'
import { useState, useEffect, useRef } from 'react'
import { getServicesByClient, getSubtasksByService, getCommentsBySubtask, toggleSubtaskWithSync, createComment, createSubtask, getVinculos } from '@/lib/db'
import { ini, fmtDate, nowStr } from '@/lib/utils'
import type { Client, Service, Subtask, Comment, Vinculo } from '@/lib/types'

interface Props {
        client: Client
        onEdit: () => void
        onDelete: () => void
        onReload?: () => void
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
        const [newComment, setNewComment] = useState<Record<string, string>>({})
        const [addFormSvc, setAddFormSvc] = useState<string | null>(null)
        const [addForm, setAddForm] = useState({ title: '', date: '', time: '', resp: 'Ellen Maximiano', obs: '', papel: 'Representado' })
        const [showDotsMenu, setShowDotsMenu] = useState(false)
        const dotsRef = useRef<HTMLDivElement>(null)

  // Papel visual (Representado / Representante) por subtarefa - apenas frontend
  const [papelBySub, setPapelBySub] = useState<Record<string, string>>({})

  useEffect(() => {
            function handleClick(e: MouseEvent) {
                        if (dotsRef.current && !dotsRef.current.contains(e.target as Node)) {
                                      setShowDotsMenu(false)
                        }
            }
            document.addEventListener('mousedown', handleClick)
            return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function load() {
            setLoading(true)
            try {
                        const svcs = await getServicesByClient(client.id)
                        setServices(svcs)
                        const smap: Record<string, Subtask[]> = {}
                                    const cmap: Record<string, Comment[]> = {}
                                                await Promise.all(svcs.map(async s => {
                                                              const subs = await getSubtasksByService(s.id)
                                                              smap[s.id] = subs
                                                              await Promise.all(subs.map(async sub => {
                                                                              cmap[sub.id] = await getCommentsBySubtask(sub.id)
                                                              }))
                                                }))
                        setSubtasks(smap)
                        setComments(cmap)
                        const vs = await getVinculos(client.id)
                        setVinculos(vs)
            } finally {
                        setLoading(false)
            }
  }

  useEffect(() => { load() }, [client.id])

  async function toggleSub(sub: Subtask) {
            await toggleSubtaskWithSync(sub.id, !sub.done)
            showToast(!sub.done ? 'Concluida!' : 'Reaberta.')
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
            await createSubtask({
                        service_id: svId,
                        title: addForm.title,
                        done: false,
                        resp: addForm.resp as any,
                        date: addForm.date || undefined,
                        time: addForm.time || undefined
            })
            const newSubs = await getSubtasksByService(svId)
            const last = newSubs[newSubs.length - 1]
            if (last) {
                        // Salva papel visual (Representado/Representante) no estado local
              setPapelBySub(p => ({ ...p, [last.id]: addForm.papel }))
                        if (addForm.obs.trim()) {
                                      await createComment({
                                                      subtask_id: last.id,
                                                      author: addForm.resp,
                                                      av: addForm.resp === 'Ellen Maximiano' ? 'ave' : 'ava',
                                                      init: addForm.resp === 'Ellen Maximiano' ? 'EM' : 'AM',
                                                      text: addForm.obs,
                                                      dt: nowStr()
                                      })
                        }
            }
            setAddFormSvc(null)
            setAddForm({ title: '', date: '', time: '', resp: 'Ellen Maximiano', obs: '', papel: 'Representado' })
            showToast('Subtarefa adicionada!')
            load()
  }

  const pending = Object.values(subtasks).flat().filter(s => !s.done).length
        const done = Object.values(subtasks).flat().filter(s => s.done).length

  // Helper: decide se o cliente vinculado e Representado ou Representante
  // Se o cliente vinculado tiver o badge "Representante", mostra "Representante", caso contrario "Representado"
  function papelVinculo(linked: any): string {
            if (!linked) return 'Representado'
            const badges: string[] = linked.badges || []
                      return badges.some(b => (b || '').toLowerCase() === 'representante') ? 'Representante' : 'Representado'
  }

  // Helper: formata pluralizacao de pendencias
  function pendLabel(n: number): string {
            return `${n} ${n === 1 ? 'PendÃªncia' : 'PendÃªncias'}`
  }

  const tipoBg: Record<string, string> = { prev: '#E6F1FB', contab: '#EEEDFE', assessoria: '#FAEEDA', cliente: '#EAF3DE', interno: 'var(--bg-secondary)' }
        const tipoCl: Record<string, string> = { prev: '#185FA5', contab: '#534AB7', assessoria: '#BA7517', cliente: '#3B6D11', interno: 'var(--text-secondary)' }
        const tipoIco: Record<string, string> = { prev: 'ico-p', contab: 'ico-c', assessoria: 'ico-c', cliente: 'ico-g' }

  return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Header do painel */}
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid var(--border-light)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                      <div className="avatar avatar-lg" style={{ background: client.av_bg, color: client.av_cl, flexShrink: 0 }}>
                                            {ini(client.name)}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{client.name}</div>
                                                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        <span>{client.cnpj || client.cpf || client.meta}</span>
                                                            {client.badges.map(b => (
                                <span key={b} className={`badge badge-${b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : 'rep'}`}>{b}</span>
                              ))}
                                                      </div>
                                      </div>
                              {/* Menu tres pontinhos */}
                                <div ref={dotsRef} style={{ position: 'relative', flexShrink: 0 }}>
                                          <button
                                                            className="btn btn-icon btn-ghost"
                                                            onClick={() => setShowDotsMenu(v => !v)}
                                                            title="Opcoes"
                                                            style={{ fontSize: 18, letterSpacing: 1 }}
                                                          >
                                                      &#8943;
                                          </button>
                                      {showDotsMenu && (
                              <div style={{
                                                  position: 'absolute', top: 'calc(100% + 5px)', right: 0,
                                                  background: 'var(--bg-primary)', border: '0.5px solid var(--border-medium)',
                                                  borderRadius: 'var(--radius-lg)', overflow: 'hidden', zIndex: 200, minWidth: 180,
                                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)'
                              }}>
                                            <div
                                                                  onClick={() => { setShowDotsMenu(false); onEdit() }}
                                                                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                >
                                                            <span>&#9998;</span> Editar cliente
                                            </div>
                                            <div style={{ height: '0.5px', background: 'var(--border-light)' }} />
                                            <div
                                                                  onClick={() => { setShowDotsMenu(false); onDelete() }}
                                                                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}
                                                                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                                                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                >
                                                            <span>&#128465;</span> Excluir cliente
                                            </div>
                              </div>
                                          )}
                                </div>
                        </div>
            
                  {/* Scrollable content */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* Stats */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid var(--border-light)' }}>
                                {[{ label: 'Pendentes', val: pending }, { label: 'Concluidas', val: done }, { label: 'Servicos', val: services.length }].map((s, i) => (
                              <div key={i} style={{ textAlign: 'center', padding: '1rem 0.5rem', borderRight: i < 2 ? '0.5px solid var(--border-light)' : 'none' }}>
                                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                  
                        {/* Vinculos */}
                        {vinculos.length > 0 && (
                            <div>
                                  {vinculos.map(v => {
                                                const papel = papelVinculo(v.linked_client)
                                                                    return (
                                                                                          <div key={v.id} style={{ padding: '0.875rem 1.5rem', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)' }}>
                                                                                                            <div className="avatar" style={{ background: v.linked_client?.av_bg || '#e0e0e0', color: v.linked_client?.av_cl || '#555', flexShrink: 0 }}>
                                                                                                                  {ini(v.linked_client?.name || '?')}
                                                                                                                  </div>
                                                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                                <div style={{ fontSize: 14, fontWeight: 500 }}>{v.linked_client?.name || v.linked_id}</div>
                                                                                                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.rels.join(', ')} &bull; {pendLabel(pending)} &bull; {papel}</div>
                                                                                                                  </div>
                                                                                                            <span className="badge" style={{ background: '#EEF6FF', color: '#2563EB', fontSize: 11 }}>&#8226; Sync</span>
                                                                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&#8250;</span>
                                                                                                </div>
                                                                                        )
                                  })}
                            </div>
                          )}
                  
                        {/* Observacoes */}
                        {client.obs && (
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '0.5px solid var(--border-light)' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>OBSERVACOES</div>
                                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                              {client.obs}
                                        </div>
                            </div>
                          )}
                  
                        {/* Servicos e Tarefas */}
                          <div style={{ padding: '1rem 1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-secondary)' }}>SERVICOS E TAREFAS</div>
                                          {services.length > 0 && (
                                <button
                                                      className="btn btn-ghost"
                                                      style={{ fontSize: 11, padding: '2px 8px' }}
                                                      onClick={() => {
                                                                              const firstSvc = services[0]
                                                                                                      if (firstSvc) {
                                                                                                                                setOpenSvc(prev => prev.includes(firstSvc.id) ? prev : [...prev, firstSvc.id])
                                                                                                                                                          setAddFormSvc(firstSvc.id)
                                                                                                                                                                                    setAddForm({ title: '', date: '', time: '', resp: 'Ellen Maximiano', obs: '', papel: 'Representado' })
                                                                                                                                                                                                            }
                                                      }}
                                                    >
                                                + Adicionar tarefa
                                </button>
                                                )}
                                    </div>
                                {loading ? (
                              <div className="empty">Carregando...</div>
                            ) : services.length === 0 ? (
                              <div className="empty">
                                            Nenhum servico cadastrado.
                                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                                                            Cadastre um servico para poder adicionar tarefas.
                                            </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {services.map(svc => {
                                                    const subs = subtasks[svc.id] || []
                                                                          const pend = subs.filter(s => !s.done).length
                                                                                                const isOpen = openSvc.includes(svc.id)
                                                                                                                      return (
                                                                                                                                              <div key={svc.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                                                                                                                                                                  <div
                                                                                                                                                                                              style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                                                                                                                                                                              onClick={() => setOpenSvc(prev => prev.includes(svc.id) ? prev.filter(x => x !== svc.id) : [...prev, svc.id])}
                                                                                                                                                                                            >
                                                                                                                                                                                        <div style={{ width: 30, height: 30, borderRadius: 8, background: tipoBg[svc.tipo] || '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                                                                                                                                                                <span style={{ color: tipoCl[svc.tipo] || '#666', fontSize: 14 }}>&#9776;</span>
                                                                                                                                                                                                              </div>
                                                                                                                                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                                                                                                                                                                          <span style={{ fontSize: 13, fontWeight: 500 }}>{svc.nome}</span>
                                                                                                                                                                                                                                          {svc.sync_group && <span className="badge" style={{ background: '#EEF6FF', color: '#2563EB', fontSize: 10 }}>Sync</span>}
                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                {svc.orig && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{svc.orig}</div>}
                                                                                                                                                                                                              </div>
                                                                                                                                                                        {pend > 0 && (
                                                                                                                                                                                                                          <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                                                                                                                                                                                                                                    {pend} pend.
                                                                                                                                                                                                                                                  </span>
                                                                                                                                                                                        )}
                                                                                                                                                                                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{isOpen ? '&#8743;' : '&#8744;'}</span>
                                                                                                                                                                        </div>
                                                                                                                                              
                                                                                                                                                    {isOpen && (
                                                                                                                                                                          <div style={{ borderTop: '0.5px solid var(--border-light)' }}>
                                                                                                                                                                                {subs.map(sub => {
                                                                                                                                                                                                          const papel = papelBySub[sub.id]
                                                                                                                                                                                                                                          return (
                                                                                                                                                                                                                                                                            <div key={sub.id} style={{ padding: '0.625rem 1rem', borderBottom: '0.5px solid var(--border-light)' }}>
                                                                                                                                                                                                                                                                                                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                                                                                                                                                                                                                                                                                                          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: sub.done ? '#22c55e' : '#ef4444', flexShrink: 0, marginTop: 2 }} />
                                                                                                                                                                                                                                                                                                                                          <input type="checkbox" checked={sub.done} onChange={() => toggleSub(sub)} style={{ marginTop: 3, cursor: 'pointer' }} />
                                                                                                                                                                                                                                                                                                                                          <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                                                                                                                                                                                                                                                                            <div style={{ fontSize: 13, textDecoration: sub.done ? 'line-through' : 'none', color: sub.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                                                                                                                                                                                                                                                                                                                                                                                                {sub.title}
                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                                                                                                                                                                                                                                                                                                                                                                                {sub.resp && (
                                                                                                                                                                                                                                                                                                                        <span style={{ fontSize: 10, background: sub.resp === 'Ellen Maximiano' ? '#EEF6FF' : '#FFF7ED', color: sub.resp === 'Ellen Maximiano' ? '#2563EB' : '#C2410C', borderRadius: 4, padding: '2px 6px' }}>
                                                                                                                                                                                                                                                                                                                                                                {sub.resp.split(' ')[0]}
                                                                                                                                                                                                                                                                                                                                                              </span>
                                                                                                                                                                                                                                                                                                                                                                                                                )}
                                                                                                                                                                                                                                                                                                                                                                                                                {papel && (
                                                                                                                                                                                                                                                                                                                        <span style={{ fontSize: 10, background: papel === 'Representante' ? '#ECFDF5' : '#FEF3C7', color: papel === 'Representante' ? '#047857' : '#92400E', borderRadius: 4, padding: '2px 6px', fontWeight: 500 }}>
                                                                                                                                                                                                                                                                                                                                                                {papel}
                                                                                                                                                                                                                                                                                                                                                              </span>
                                                                                                                                                                                                                                                                                                                                                                                                                )}
                                                                                                                                                                                                                                                                                                                                                                                                                {sub.sync_group && <span className="badge" style={{ fontSize: 10, background: '#EEF6FF', color: '#2563EB' }}>Sync</span>}
                                                                                                                                                                                                                                                                                                                                                                                                                {sub.date && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtDate(sub.date, sub.time) || ''}</span>}
                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                                                                                                          <button
                                                                                                                                                                                                                                                                                                                                                                                  style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                                                                                                                                                                                                                                                                                                                                  onClick={() => setOpenCmt(prev => prev.includes(sub.id) ? prev.filter(x => x !== sub.id) : [...prev, sub.id])}
                                                                                                                                                                                                                                                                                                                                                                                >
                                                                                                                                                                                                                                                                                                                                                                            &#8744;
                                                                                                                                                                                                                                                                                                                                                                          </button>
                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                          {openCmt.includes(sub.id) && (
                                                                                                                                                                                                                                                                                                                  <div style={{ marginLeft: 33, marginTop: 8 }}>
                                                                                                                                                                                                                                                                                                                                                    {(comments[sub.id] || []).map((c, i) => (
                                                                                                                                                                                                                                                                                                                                                            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                                                                                                                                                                                                                                                                                                                                                                                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.init}</span> {c.text}
                                                                                                                                                                                                                                                                                                                                                                                                  <span style={{ marginLeft: 6, fontSize: 10 }}>{c.dt}</span>
                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                          ))}
                                                                                                                                                                                                                                                                                                                                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                                                                                                                                                                                                                                                                                                                                                        <input
                                                                                                                                                                                                                                                                                                                                                                                                                                    className="form-input"
                                                                                                                                                                                                                                                                                                                                                                                                                                    style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
                                                                                                                                                                                                                                                                                                                                                                                                                                    placeholder="Adicionar comentario..."
                                                                                                                                                                                                                                                                                                                                                                                                                                    value={newComment[sub.id] || ''}
                                                                                                                                                                                                                                                                                                                                                                                                                                    onChange={e => setNewComment(p => ({ ...p, [sub.id]: e.target.value }))}
                                                                                                                                                                                                                                                                                                                                                                                                                                    onKeyDown={e => { if (e.key === 'Enter') sendComment(sub.id) }}
                                                                                                                                                                                                                                                                                                                                                                                                                                  />
                                                                                                                                                                                                                                                                                                                                                                                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => sendComment(sub.id)}>Enviar</button>
                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                          )}
                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                          )
                                                                                                                                                                                                              })}
                                                                                                                                                                                {/* Adicionar subtarefa */}
                                                                                                                                                                                {addFormSvc === svc.id ? (
                                                                                                                                                                                                          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)' }}>
                                                                                                                                                                                                                                      <input
                                                                                                                                                                                                                                                                          className="form-input"
                                                                                                                                                                                                                                                                          placeholder="Titulo da subtarefa"
                                                                                                                                                                                                                                                                          value={addForm.title}
                                                                                                                                                                                                                                                                          onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                                                                                                                                                                                                                                                          autoFocus
                                                                                                                                                                                                                                                                          style={{ marginBottom: 6 }}
                                                                                                                                                                                                                                                                        />
                                                                                                                                                                                                                                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                                                                                                                                                                                                                                                    <input type="date" className="form-input" style={{ flex: 1 }} value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
                                                                                                                                                                                                                                                                    <input type="time" className="form-input" style={{ flex: 1 }} value={addForm.time} onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))} />
                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                      <select className="form-input" value={addForm.resp} onChange={e => setAddForm(f => ({ ...f, resp: e.target.value }))} style={{ marginBottom: 6 }}>
                                                                                                                                                                                                                                                                    <option value="Ellen Maximiano">Ellen Maximiano</option>
                                                                                                                                                                                                                                                                    <option value="Andrews Maximiano">Andrews Maximiano</option>
                                                                                                                                                                                                                                                                  </select>
                                                                                                                                                                                                                                      <select className="form-input" value={addForm.papel} onChange={e => setAddForm(f => ({ ...f, papel: e.target.value }))} style={{ marginBottom: 6 }}>
                                                                                                                                                                                                                                                                    <option value="Representado">Representado</option>
                                                                                                                                                                                                                                                                    <option value="Representante">Representante</option>
                                                                                                                                                                                                                                                                  </select>
                                                                                                                                                                                                                                      <textarea className="form-input form-textarea" placeholder="Observacao (opcional)" value={addForm.obs} onChange={e => setAddForm(f => ({ ...f, obs: e.target.value }))} style={{ marginBottom: 6 }} />
                                                                                                                                                                                                                                      <div style={{ display: 'flex', gap: 6 }}>
                                                                                                                                                                                                                                                                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveSubtask(svc.id)}>Salvar</button>
                                                                                                                                                                                                                                                                    <button className="btn btn-ghost" onClick={() => setAddFormSvc(null)}>Cancelar</button>
                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                        ) : (
                                                                                                                                                                                                          <div style={{ padding: '0.625rem 1rem', display: 'flex', gap: 6 }}>
                                                                                                                                                                                                                                      <button
                                                                                                                                                                                                                                                                          className="btn btn-ghost"
                                                                                                                                                                                                                                                                          style={{ fontSize: 12 }}
                                                                                                                                                                                                                                                                          onClick={() => { setAddFormSvc(svc.id); setAddForm({ title: '', date: '', time: '', resp: 'Ellen Maximiano', obs: '', papel: 'Representado' }) }}
                                                                                                                                                                                                                                                                        >
                                                                                                                                                                                                                                                                    + Adicionar tarefa
                                                                                                                                                                                                                                                                  </button>
                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                  )}
                                                                                                                                                                                </div>
                                                                                                                                                                  )}
                                                                                                                                                    </div>
                                                                                                                                            )
                                    })}
                              </div>
                                    )}
                          </div>
                  </div>
            </div>
          )
}
