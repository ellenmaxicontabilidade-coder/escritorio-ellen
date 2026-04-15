'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getClients, createClient, updateClient, getVinculos, createVinculoBidirecional, deleteClientCompleto } from '@/lib/db'
import { ini, getColor, badgeCls } from '@/lib/utils'
import type { Client, Vinculo, Badge, TipoVinculo } from '@/lib/types'
import ClientPanel from './ClientPanel'

interface Props {
    showToast: (msg: string, type?: 'success' | 'danger') => void
}

interface PendingVinculo {
    linked_id: string
    linked_name: string
    rels: string[]
    tipo: TipoVinculo
    outro_val?: string
}

const RELS_OPTS = ['Cônjuge', 'Sócio', 'Dependente']

export default function ClientsView({ showToast }: Props) {
    const [clients, setClients] = useState<Client[]>([])
    const [vinculosByClient, setVinculosByClient] = useState<Record<string, Vinculo[]>>({})
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)
    const [form, setForm] = useState({ name: '', cpf: '', cnpj: '', badges: [] as Badge[], obs: '' })
    const [pendingVinculos, setPendingVinculos] = useState<PendingVinculo[]>([])
    const [savedVinculos, setSavedVinculos] = useState<Vinculo[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerStep, setDrawerStep] = useState<1 | 2 | 3>(1)
    const [drawerTipo, setDrawerTipo] = useState<TipoVinculo | null>(null)
    const [drawerClientId, setDrawerClientId] = useState<string | null>(null)
    const [drawerRels, setDrawerRels] = useState<string[]>([])
    const [drawerOutro, setDrawerOutro] = useState('')
    const [drawerSearch, setDrawerSearch] = useState('')

  const load = useCallback(async () => {
        const list = await getClients()
        setClients(list)
        const vmap: Record<string, Vinculo[]> = {}
              await Promise.all(list.map(async c => { vmap[c.id] = await getVinculos(c.id) }))
        setVinculosByClient(vmap)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
        clients.filter(c =>
                !search ||
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                (c.meta || '').includes(search)
                           ), [clients, search])

  const groups = useMemo(() => {
        const placed = new Set<string>()
        const result: Client[][] = []
              filtered.forEach(client => {
                      if (placed.has(client.id)) return
                      const vs = vinculosByClient[client.id] || []
                              const linkedIds = vs.map(v => v.linked_id)
                      const linked = filtered.filter(c => linkedIds.includes(c.id) && !placed.has(c.id))
                      const group = [client, ...linked]
                      group.forEach(c => placed.add(c.id))
                      result.push(group)
              })
        return result
  }, [filtered, vinculosByClient])

  function resetForm() {
        setForm({ name: '', cpf: '', cnpj: '', badges: [], obs: '' })
        setPendingVinculos([])
        setSavedVinculos([])
        setEditingId(null)
        closeDrawer()
  }

  function openNew() { resetForm(); setShowModal(true) }

  async function openEdit(c: Client) {
        setEditingId(c.id)
        const meta = c.meta || ''
        const cpfGuess = (meta === 'CPF' || meta === 'CPF + CNPJ') ? '' : meta.split('·')[0].trim()
        setForm({ name: c.name, cpf: cpfGuess, cnpj: c.cnpj || '', badges: c.badges || [], obs: c.obs || '' })
        const vs = vinculosByClient[c.id] || await getVinculos(c.id)
        setSavedVinculos(vs)
        setPendingVinculos([])
        setShowModal(true)
  }

  function closeDrawer() {
        setDrawerOpen(false); setDrawerStep(1); setDrawerTipo(null); setDrawerClientId(null)
        setDrawerRels([]); setDrawerOutro(''); setDrawerSearch('')
  }

  function toggleBadge(b: Badge) {
        setForm(f => ({ ...f, badges: f.badges.includes(b) ? f.badges.filter(x => x !== b) : [...f.badges, b] }))
  }

  function metaLabel(): string {
        const hasPJ = form.badges.includes('PJ')
        if (hasPJ && form.cpf && form.cnpj) return `${form.cpf} · ${form.cnpj}`
        if (hasPJ && form.cnpj) return form.cnpj
        if (form.cpf) return form.cpf
        return hasPJ ? 'CPF + CNPJ' : 'CPF'
  }

  async function saveClient() {
        if (!form.name.trim()) { showToast('Nome é obrigatório', 'danger'); return }
        try {
                const color = getColor(form.name)
                const payload = {
                          name: form.name.trim(),
                          meta: metaLabel(),
                          cnpj: form.cnpj.trim() || undefined,
                          badges: form.badges,
                          obs: form.obs,
                          av_bg: color.bg,
                          av_cl: color.cl,
                }
                let clientId: string
                if (editingId) {
                          await updateClient(editingId, payload); clientId = editingId
                } else {
                          const c = await createClient(payload as any); clientId = c.id
                }
                for (const pv of pendingVinculos) {
                          await createVinculoBidirecional(clientId, pv.linked_id, pv.rels, pv.tipo, pv.outro_val)
                }
                showToast(editingId ? 'Cliente atualizado' : 'Cliente cadastrado')
                setShowModal(false); resetForm(); await load()
        } catch (e: any) { showToast('Erro ao salvar: ' + (e.message || e), 'danger') }
  }

  async function doDelete() {
        if (!confirmDelete) return
        try {
                await deleteClientCompleto(confirmDelete.id)
                showToast('Cliente excluído'); setConfirmDelete(null); setSelectedId(null); await load()
        } catch (e: any) { showToast('Erro ao excluir: ' + (e.message || e), 'danger') }
  }

  function confirmDrawer() {
        if (!drawerTipo || !drawerClientId || drawerRels.length === 0) return
        const linked = clients.find(c => c.id === drawerClientId)
        if (!linked) return
        setPendingVinculos(prev => [...prev, {
                linked_id: drawerClientId, linked_name: linked.name,
                rels: drawerRels, tipo: drawerTipo, outro_val: drawerOutro || undefined
        }])
        closeDrawer()
  }

  const alreadyLinkedIds = new Set<string>([
        ...savedVinculos.map(v => v.linked_id),
        ...pendingVinculos.map(v => v.linked_id),
        ...(editingId ? [editingId] : [])
      ])

  const drawerClients = clients.filter(c =>
        !alreadyLinkedIds.has(c.id) &&
        (!drawerSearch || c.name.toLowerCase().includes(drawerSearch.toLowerCase()))
                                         )

  const previewColor = form.name ? getColor(form.name) : { bg: '#eef2f7', cl: '#94a3b8' }
    const selectedClient = selectedId ? clients.find(c => c.id === selectedId) : null

  return (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', height: 'calc(100vh - 56px)', margin: '-1.5rem', overflow: 'hidden' }}>
          {/* COLUNA ESQUERDA - Lista de clientes */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '0.5px solid var(--border-light)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  {/* Barra de busca fixa */}
                          <div style={{ display: 'flex', gap: 8, padding: '1rem', borderBottom: '0.5px solid var(--border-light)', background: 'var(--bg-primary)', flexShrink: 0 }}>
                                      <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Buscar cliente, CPF, CNPJ..."
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                    style={{ flex: 1 }}
                                                  />
                                      <button onClick={openNew} className="btn btn-primary">+ Novo cliente</button>button>
                          </div>div>
                
                  {/* Lista scrollável */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem' }}>
                          {groups.map((group, gi) => {
                      const label = group.length > 1 ? group.map(c => c.name.split(' ')[0]).join(' + ') : null
                                    return (
                                                    <div key={gi} style={{ marginBottom: 12 }}>
                                                      {label && (
                                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                                            👥 {label}
                                                                        </div>div>
                                                                    )}
                                                                    <div className="card" style={{ overflow: 'hidden' }}>
                                                                      {group.map((c, idx) => {
                                                                          const vs = vinculosByClient[c.id] || []
                                                                                                const isSelected = selectedId === c.id
                                                                                                                      return (
                                                                                                                                              <div key={c.id} onClick={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                                                                                                                                                                        style={{
                                                                                                                                                                                                    padding: '10px 12px', cursor: 'pointer',
                                                                                                                                                                                                    borderBottom: idx < group.length - 1 ? '0.5px solid var(--border-light)' : 'none',
                                                                                                                                                                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                                                                                                                                                                    background: isSelected ? 'var(--purple-50)' : 'var(--bg-primary)',
                                                                                                                                                                                                    borderLeft: isSelected ? '3px solid var(--purple-500)' : '3px solid transparent',
                                                                                                                                                                                                    transition: 'background 0.1s'
                                                                                                                                                                                                                              }}>
                                                                                                                                                                      <div className="avatar" style={{ width: 34, height: 34, background: c.av_bg, color: c.av_cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                                                                                                                                                        {ini(c.name)}
                                                                                                                                                                        </div>div>
                                                                                                                                                                      <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                                                                                                <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'var(--purple-800)' : 'var(--text-primary)' }}>{c.name}</div>div>
                                                                                                                                                                                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{c.meta}</div>div>
                                                                                                                                                                        {vs.length > 0 && (
                                                                                                                                                                                                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                                                                                                                                                                                                    {vs.slice(0, 2).map(v => `↔ ${v.linked_client?.name || ''}`).join(' · ')}
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                )}
                                                                                                                                                                        {/* Tags de serviço */}
                                                                                                                                                                        {vs.length > 0 && (
                                                                                                                                                                                                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                                                                                                                                                                                                    {vs.slice(0, 2).map(v => (
                                                                                                                                                                                                                                        <span key={v.id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                                                                                                                                                                                                                                                                          {v.rels?.join(', ')}
                                                                                                                                                                                                                                                                        </span>span>
                                                                                                                                                                                                                                      ))}
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                )}
                                                                                                                                                                        </div>div>
                                                                                                                                                                      <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                                                                                                                        {(c.badges || []).map(b => (<span key={b} className={badgeCls(b)}>{b}</span>span>))}
                                                                                                                                                                        </div>div>
                                                                                                                                                </div>div>
                                                                                                                                            )
                                                                      })}
                                                                    </div>div>
                                                    </div>div>
                                                  )
                          })}
                          {groups.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                    Nenhum cliente cadastrado
                      </div>div>
                                  )}
                        </div>div>
                </div>div>
        
          {/* COLUNA DIREITA - Painel de detalhes */}
              <div style={{ overflowY: 'auto', background: 'var(--bg-primary)' }}>
                {selectedClient ? (
                    <ClientPanel
                                  client={selectedClient}
                                  onEdit={() => { setSelectedId(null); openEdit(selectedClient) }}
                                  onDelete={() => { setConfirmDelete(selectedClient); setSelectedId(null) }}
                                  showToast={showToast}
                                />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-tertiary)' }}>
                                <div style={{ fontSize: 32 }}>👤</div>div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>Selecione um cliente</div>div>
                                <div style={{ fontSize: 12 }}>Clique em um cliente na lista para ver os detalhes</div>div>
                    </div>div>
                      )}
              </div>div>
        
          {/* MODAL - Novo/Editar cliente */}
          {showModal && (
                  <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
                            <div className="modal-box" style={{ width: 'min(520px, 100%)' }} onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                                      <div className="modal-title">{editingId ? 'Editar cliente' : 'Novo cliente'}</div>div>
                                                      <button onClick={() => { setShowModal(false); resetForm() }} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, fontSize: 14, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>button>
                                        </div>div>
                                        <div style={{ padding: '14px 1.5rem', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border-light)' }}>
                                                      <div className="avatar" style={{ width: 44, height: 44, background: previewColor.bg, color: previewColor.cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
                                                        {form.name ? ini(form.name) : '?'}
                                                      </div>div>
                                                      <div style={{ flex: 1, minWidth: 0 }}>
                                                                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{form.name || 'Nome do cliente'}</div>div>
                                                                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{metaLabel()}</div>div>
                                                      </div>div>
                                                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                        {form.badges.map(b => <span key={b} className={badgeCls(b)}>{b}</span>span>)}
                                                      </div>div>
                                        </div>div>
                                        <div className="modal-body">
                                                      <div className="form-field">
                                                                      <label className="form-label">Nome completo</label>label>
                                                                      <input type="text" className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Maria Silva" />
                                                      </div>div>
                                                      <div className="form-field">
                                                                      <label className="form-label">CPF</label>label>
                                                                      <input type="text" className="form-input" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                                                      </div>div>
                                          {form.badges.includes('PJ') && (
                                    <div className="form-field">
                                                      <label className="form-label">CNPJ</label>label>
                                                      <input type="text" className="form-input" value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                                    </div>div>
                                                      )}
                                                      <div className="form-field">
                                                                      <label className="form-label">Classificação</label>label>
                                                                      <div style={{ display: 'flex', gap: 6 }}>
                                                                        {(['PF','PJ','Representante'] as Badge[]).map(b => {
                                        const active = form.badges.includes(b)
                                                              return (
                                                                                      <button key={b} type="button" onClick={() => toggleBadge(b)} style={{ padding: '5px 14px', borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: active ? '1px solid var(--purple-400)' : '0.5px solid var(--border-medium)', background: active ? 'var(--purple-50)' : 'var(--bg-primary)', color: active ? 'var(--purple-700)' : 'var(--text-secondary)' }}>
                                                                                        {b}
                                                                                        </button>button>
                                                                                    )
                  })}
                                                                      </div>div>
                                                      </div>div>
                                                      <div className="form-field">
                                                                      <label className="form-label">Observações</label>label>
                                                                      <textarea className="form-input form-textarea" value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} placeholder="Anotações internas sobre o cliente..." />
                                                      </div>div>
                                                      <div className="form-field">
                                                                      <label className="form-label">Vínculos</label>label>
                                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                        {savedVinculos.map(v => (
                                        <div key={v.id} style={{ padding: '8px 12px', background: 'var(--purple-50)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                              <span style={{ fontWeight: 500 }}>{v.linked_client?.name}</span>span>
                                                              <span style={{ color: 'var(--text-secondary)' }}>— {(v.rels||[]).join(', ')}</span>span>
                                                              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--purple-700)', fontWeight: 500 }}>
                                                                {v.tipo === 'rep' ? 'Representante' : 'Representado'}
                                                              </span>span>
                                        </div>div>
                                      ))}
                                                                        {pendingVinculos.map((v, i) => (
                                        <div key={'p'+i} style={{ padding: '8px 12px', background: 'var(--purple-50)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed var(--purple-300, #d8b4fe)' }}>
                                                              <span style={{ fontWeight: 500 }}>{v.linked_name}</span>span>
                                                              <span style={{ color: 'var(--text-secondary)' }}>— {v.rels.join(', ')}</span>span>
                                                              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--purple-700)', fontWeight: 500 }}>
                                                                {v.tipo === 'rep' ? 'Representante' : 'Representado'}
                                                              </span>span>
                                                              <button onClick={() => setPendingVinculos(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13 }}>✕</button>button>
                                        </div>div>
                                      ))}
                                                                        {!drawerOpen && (
                                        <button type="button" onClick={() => setDrawerOpen(true)} style={{ padding: '10px', border: '1px dashed var(--border-medium)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'inherit' }}>
                                                              + Vincular a cliente existente
                                        </button>button>
                                                                                        )}
                                                                      </div>div>
                                                      </div>div>
                                          {drawerOpen && (
                                    <div style={{ border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: 14, background: 'var(--bg-secondary)', marginTop: 4 }}>
                                                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                                        {drawerStep === 1 && 'Passo 1 — Tipo de vínculo'}
                                                        {drawerStep === 2 && 'Passo 2 — Escolher cliente'}
                                                        {drawerStep === 3 && 'Passo 3 — Classificar relação'}
                                                      </div>div>
                                      {drawerStep === 1 && (
                                                          <div style={{ display: 'flex', gap: 8 }}>
                                                            {(['rep', 'repd'] as TipoVinculo[]).map(t => (
                                                                                    <button key={t} type="button" onClick={() => { setDrawerTipo(t); setDrawerStep(2) }} style={{ flex: 1, padding: '12px', border: drawerTipo === t ? '1px solid var(--purple-400)' : '0.5px solid var(--border-medium)', borderRadius: 8, background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 12, textAlign: 'left', fontFamily: 'inherit' }}>
                                                                                                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t === 'rep' ? 'Representante' : 'Representado'}</div>div>
                                                                                                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{t === 'rep' ? 'Age em nome de outro' : 'É representado por outro'}</div>div>
                                                                                      </button>button>
                                                                                  ))}
                                                          </div>div>
                                                      )}
                                      {drawerStep === 2 && (
                                                          <div>
                                                                                <input type="text" className="form-input" placeholder="Buscar cliente..." value={drawerSearch} onChange={e => setDrawerSearch(e.target.value)} style={{ marginBottom: 8 }} />
                                                                                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                                  {drawerClients.map(c => (
                                                                                      <button key={c.id} type="button" onClick={() => { setDrawerClientId(c.id); setDrawerStep(3) }} style={{ padding: '8px 10px', border: drawerClientId === c.id ? '1px solid var(--purple-400)' : '0.5px solid var(--border-medium)', borderRadius: 6, background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
                                                                                                                  <div className="avatar" style={{ width: 26, height: 26, background: c.av_bg, color: c.av_cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{ini(c.name)}</div>div>
                                                                                                                  <span style={{ flex: 1, color: 'var(--text-primary)' }}>{c.name}</span>span>
                                                                                        {drawerClientId === c.id && <span style={{ color: 'var(--purple-600)' }}>✓</span>span>}
                                                                                        </button>button>
                                                                                    ))}
                                                                                  {drawerClients.length === 0 && (
                                                                                      <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Nenhum cliente disponível</div>div>
                                                                                                        )}
                                                                                  </div>div>
                                                          </div>div>
                                                      )}
                                      {drawerStep === 3 && (
                                                          <div>
                                                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                                                                  {RELS_OPTS.map(r => {
                                                                                      const active = drawerRels.includes(r)
                                                                                                                  return (
                                                                                                                                                <button key={r} type="button" onClick={() => {
                                                                                                                                                                                if (drawerTipo === 'repd') setDrawerRels(active ? [] : [r])
                                                                                                                                                                                                                else setDrawerRels(prev => active ? prev.filter(x => x !== r) : [...prev, r])
                                                                                                                                                                                                                                              }} style={{ padding: '5px 12px', border: active ? '1px solid var(--purple-400)' : '0.5px solid var(--border-medium)', borderRadius: 14, background: active ? 'var(--purple-50)' : 'var(--bg-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: active ? 'var(--purple-700)' : 'var(--text-secondary)', fontFamily: 'inherit' }}>
                                                                                                                                                  {r}
                                                                                                                                                  </button>button>
                                                                                                                                              )
                                                                                    })}
                                                                                                        <button type="button" onClick={() => {
                                                                                      const has = drawerRels.includes('Outros')
                                                                                                                  if (drawerTipo === 'repd') setDrawerRels(has ? [] : ['Outros'])
                                                                                                                                              else setDrawerRels(prev => has ? prev.filter(x => x !== 'Outros') : [...prev, 'Outros'])
                                                            }} style={{ padding: '5px 12px', border: drawerRels.includes('Outros') ? '1px solid var(--purple-400)' : '1px dashed var(--border-medium)', borderRadius: 14, background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                                                                                                                                  + Outros
                                                                                                          </button>button>
                                                                                  </div>div>
                                                            {drawerRels.includes('Outros') && (
                                                                                    <input type="text" className="form-input" placeholder="Descreva a relação..." value={drawerOutro} onChange={e => setDrawerOutro(e.target.value)} style={{ marginBottom: 10 }} />
                                                                                  )}
                                                          </div>div>
                                                      )}
                                                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, gap: 8, paddingTop: 10, borderTop: '0.5px solid var(--border-light)' }}>
                                                                          <div style={{ display: 'flex', gap: 4 }}>
                                                                            {[1,2,3].map(n => (
                                                              <span key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= drawerStep ? 'var(--purple-500)' : 'var(--border-medium)' }} />
                                                            ))}
                                                                          </div>div>
                                                                          <button type="button" onClick={closeDrawer} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 11 }}>Cancelar</button>button>
                                                                          <button type="button" disabled={!drawerTipo || !drawerClientId || drawerRels.length === 0} onClick={confirmDrawer} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 11, opacity: (!drawerTipo || !drawerClientId || drawerRels.length === 0) ? 0.5 : 1 }}>Adicionar</button>button>
                                                      </div>div>
                                    </div>div>
                                                      )}
                                        </div>div>
                                        <div className="modal-footer">
                                                      <button onClick={() => { setShowModal(false); resetForm() }} className="btn btn-secondary">Cancelar</button>button>
                                                      <button onClick={saveClient} className="btn btn-primary">{editingId ? 'Salvar alterações' : 'Cadastrar cliente'}</button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        
          {/* MODAL - Confirmar exclusão */}
          {confirmDelete && (
                  <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                            <div className="modal-box" style={{ width: 'min(400px, 100%)' }} onClick={e => e.stopPropagation()}>
                                        <div className="modal-header"><div className="modal-title">Excluir cliente</div>div></div>div>
                                        <div className="modal-body">
                                                      <div style={{ fontSize: 13 }}>Confirmar exclusão de <strong>{confirmDelete.name}</strong>strong>?</div>div>
                                                      <div style={{ fontSize: 12, color: '#b91c1c', padding: 10, background: '#fef2f2', borderRadius: 8, border: '0.5px solid #fecaca' }}>
                                                                      ⚠ Esta ação não pode ser desfeita.
                                                      </div>div>
                                        </div>div>
                                        <div className="modal-footer">
                                                      <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>button>
                                                      <button onClick={doDelete} className="btn btn-danger">Excluir cliente</button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        </div>div>
      )
}</button>
