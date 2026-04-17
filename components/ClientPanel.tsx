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

  const tipoBg: Record<string, string> = { prev: '#E6F1FB', contab: '#EEEDFE', assessoria: '#FAEEDA', cliente: '#EAF3DE', interno: 'var(--bg-secondary)' }
      const tipoCl: Record<string, string> = { prev: '#185FA5', contab: '#534AB7', assessoria: '#BA7517', cliente: '#3B6D11', interno: 'var(--text-secondary)' }
      const tipoIco: Record<string, string> = { prev: 'ico-p', contab: 'ico-c', assessoria: 'ico-c', cliente: 'ico-g' }

  return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header do painel */}
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid var(--border-light)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div className="avatar avatar-lg" style={{ background: client.av_bg, color: client.av_cl, flexShrink: 0 }}>
                                    {ini(client.name)}
                                </div>div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{client.name}</div>div>
                                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>{client.badges.join(' - ')}</span>span><span>{client.cnpj || client.meta}</span>span></span>span>
                                                  {client.badges.map(b => (
                            <span key={b} className={`badge badge-${b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : 'rep'}`}>{b}</span>span>
                          ))}
                                              </div>div>
                                </div>div>
                        {/* Menu tres pontinhos */}
                            <div ref={dotsRef} style={{ position: 'relative', flexShrink: 0 }}>
                                      <button
                                                      className="btn btn-icon btn-ghost"
                                                      onClick={() => setShowDotsMenu(v => !v)}
                                                      title="Opcoes"
                                                      style={{ fontSize: 18, letterSpacing: 1 }}
                                                    >
                                                  &#8943;
                                      </button>button>
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
                                                        <span>&#9998;</span>span> Editar cliente
                                        </div>div>
                                        <div style={{ height: '0.5px', background: 'var(--border-light)' }} />
                                        <div
                                                            onClick={() => { setShowDotsMenu(false); onDelete() }}
                                                            style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                          >
                                                        <span>&#128465;</span>span> Excluir cliente
                                        </div>div>
                          </div>div>
                                      )}
                            </div>div>
                    </div>div>
          
              {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid var(--border-light)' }}>
                            {[{ label: 'Pendentes', val: pending }, { label: 'Concluidas', val: done }, { label: 'Servicos', val: services.length }].map((s, i) => (
                          <div key={i} style={{ textAlign: 'center', padding: '1rem 0.5rem', borderRight: i < 2 ? '0.5px solid var(--border-light)' : 'none' }}>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>div>
                          </div>div>
                        ))}
                        </div>div>
                
                    {/* Vinculos */}
                    {vinculos.length > 0 && (
                        <div>
                            {vinculos.map(v => (
                                          <div key={v.id} style={{ padding: '0.875rem 1.5rem', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)' }}>
                                                          <div className="avatar" style={{ background: v.linked_client?.av_bg || '#e0e0e0', color: v.linked_client?.av_cl || '#555', flexShrink: 0 }}>
                                                              {ini(v.linked_client?.name || '?')}
                                                          </div>div>
                                                          <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ f</span>
