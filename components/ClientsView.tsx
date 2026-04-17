'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getClients, createClient, updateClient, getVinculos, createVinculoBidirecional, updateVinculoBidirecional, deleteClientCompleto, deleteVinculoBidirecional } from '@/lib/db'
import { ini, getColor } from '@/lib/utils'
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

const RELS_OPTS = ['Conjuge', 'Socio', 'Dependente']

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
  const [drawerMode, setDrawerMode] = useState<'new' | 'edit'>('new')
  const [drawerStep, setDrawerStep] = useState<1 | 2 | 3>(1)
  const [drawerTipo, setDrawerTipo] = useState<TipoVinculo | null>(null)
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null)
  const [drawerRels, setDrawerRels] = useState<string[]>([])
  const [drawerSearch, setDrawerSearch] = useState('')
  const [drawerOutro, setDrawerOutro] = useState('')
  const [editingVinculo, setEditingVinculo] = useState<{ kind: 'saved' | 'pending', id: string | number } | null>(null)

  const load = useCallback(async () => {
    const list = await getClients()
    setClients(list)
    const vmap: Record<string, Vinculo[]> = {}
    await Promise.all(list.map(async c => {
      vmap[c.id] = await getVinculos(c.id)
    }))
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
      const linkedIds = vs.map(v => v.linked_id).filter(id => filtered.some(c => c.id === id))
      const group = [client, ...linkedIds.map(id => filtered.find(c => c.id === id)!).filter(Boolean)]
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

  function closeDrawer() {
    setDrawerOpen(false)
    setDrawerMode('new')
    setDrawerStep(1)
    setDrawerTipo(null)
    setDrawerClientId(null)
    setDrawerRels([])
    setDrawerOutro('')
    setDrawerSearch('')
    setEditingVinculo(null)
  }

  function openNew() { resetForm(); setShowModal(true) }

  function openEdit(c: Client) {
    const meta = c.meta || ''
    const hasPJ = c.badges.includes('PJ')
    const cpfGuess = (meta === 'CPF' || meta === 'CPF + CNPJ') ? '' : meta.split('\u00b7')[0].trim()
    const cnpjGuess = hasPJ ? (c.cnpj || '') : ''
    setForm({ name: c.name, cpf: cpfGuess, cnpj: cnpjGuess, badges: c.badges, obs: c.obs || '' })
    setEditingId(c.id)
    const vs = vinculosByClient[c.id] || []
    setSavedVinculos(vs)
    setPendingVinculos([])
    setShowModal(true)
  }

  function buildMeta() {
    const hasPF = form.badges.includes('PF')
    const hasPJ = form.badges.includes('PJ')
    if (hasPF && hasPJ) return 'CPF + CNPJ'
    if (hasPF) return 'CPF'
    if (hasPJ) return form.cnpj || 'CNPJ'
    return form.cpf || form.cnpj || ''
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const { bg, cl } = getColor(form.name)
    const data = {
      name: form.name.trim(),
      meta: buildMeta(),
      cnpj: form.cnpj || null,
      badges: form.badges,
      obs: form.obs,
      av_bg: bg,
      av_cl: cl,
    }
    let clientId: string
    if (editingId) {
      await updateClient(editingId, data)
      clientId = editingId
    } else {
      const created = await createClient(data)
      clientId = created.id
    }
    for (const pv of pendingVinculos) {
      await createVinculoBidirecional(clientId, pv.linked_id, pv.rels, pv.tipo, pv.outro_val)
    }
    setShowModal(false)
    resetForm()
    load()
    showToast(editingId ? 'Cliente atualizado!' : 'Cliente cadastrado!')
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteClientCompleto(confirmDelete.id)
    setConfirmDelete(null)
    if (selectedId === confirmDelete.id) setSelectedId(null)
    load()
    showToast('Cliente excluido!', 'danger')
  }

  async function handleRemoveSavedVinculo(v: Vinculo) {
    await deleteVinculoBidirecional(v.client_id, v.linked_id)
    const vs = savedVinculos.filter(x => x.id !== v.id)
    setSavedVinculos(vs)
    load()
  }

  function openEditVinculo(v: Vinculo) {
    setDrawerMode('edit')
    setDrawerOpen(true)
    setDrawerStep(3)
    setDrawerTipo(v.tipo)
    setDrawerClientId(v.linked_id)
    const known = v.rels.filter(r => RELS_OPTS.includes(r))
    const extras = v.rels.filter(r => !RELS_OPTS.includes(r))
    setDrawerRels(extras.length > 0 ? [...known, 'Outros'] : known)
    setDrawerOutro(extras.join(', '))
    setEditingVinculo({ kind: 'saved', id: v.id })
  }

  function openEditPending(index: number) {
    const pv = pendingVinculos[index]
    setDrawerMode('edit')
    setDrawerOpen(true)
    setDrawerStep(3)
    setDrawerTipo(pv.tipo)
    setDrawerClientId(pv.linked_id)
    const known = pv.rels.filter(r => RELS_OPTS.includes(r))
    const extras = pv.rels.filter(r => !RELS_OPTS.includes(r))
    setDrawerRels(extras.length > 0 ? [...known, 'Outros'] : known)
    setDrawerOutro(extras.join(', '))
    setEditingVinculo({ kind: 'pending', id: index })
  }

  async function confirmDrawer() {
    if (!drawerTipo || !drawerClientId || drawerRels.length === 0) return
    const finalRels = drawerRels.includes('Outros') && drawerOutro
      ? [...drawerRels.filter(r => r !== 'Outros'), drawerOutro]
      : drawerRels.filter(r => r !== 'Outros')
    const outroVal = drawerRels.includes('Outros') ? drawerOutro : undefined

    if (drawerMode === 'edit' && editingVinculo) {
      if (editingVinculo.kind === 'saved') {
        const v = savedVinculos.find(x => x.id === editingVinculo.id)
        if (v) {
          await updateVinculoBidirecional(v.client_id, v.linked_id, finalRels, outroVal)
          setSavedVinculos(prev => prev.map(x => x.id === v.id ? { ...x, rels: finalRels, outro_val: outroVal } : x))
          load()
          showToast('Vinculo atualizado!')
        }
      } else {
        const idx = editingVinculo.id as number
        setPendingVinculos(prev => prev.map((p, i) => i === idx ? { ...p, rels: finalRels, outro_val: outroVal } : p))
      }
      closeDrawer()
      return
    }

    const linked = clients.find(c => c.id === drawerClientId)
    if (!linked) return
    setPendingVinculos(prev => [...prev, {
      linked_id: linked.id,
      linked_name: linked.name,
      rels: finalRels,
      tipo: drawerTipo,
      outro_val: outroVal,
    }])
    closeDrawer()
  }

  function startNewVinculo() {
    closeDrawer()
    setDrawerOpen(true)
    setDrawerMode('new')
    const isRep = form.badges.includes('Representante')
    const isRepd = form.badges.includes('Representado')
    if (isRep && !isRepd) {
      setDrawerTipo('rep')
      setDrawerStep(2)
    } else if (isRepd && !isRep) {
      setDrawerTipo('repd')
      setDrawerStep(2)
    } else {
      setDrawerStep(1)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedId) || null
  const showVinculosSection = form.badges.includes('Representante') || form.badges.includes('Representado')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', height: 'calc(100vh - 56px)', margin: '-1.5rem', overflow: 'hidden' }}>
      <div style={{ borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: '1rem', borderBottom: '0.5px solid var(--border-light)', background: 'var(--bg-primary)', flexShrink: 0 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openNew}>+ Novo cliente</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {groups.map(group => {
            const isGroup = group.length > 1
            const groupLabel = isGroup ? group.map(c => c.name.split(' ')[0].toUpperCase()).join(' + ') : null
            return (
              <div key={group[0].id} style={{ marginBottom: 12 }}>
                {isGroup && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>&#128101;</span> {groupLabel}
                  </div>
                )}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {group.map((c, idx) => {
                    const vs = vinculosByClient[c.id] || []
                    const isSelected = selectedId === c.id
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary-light)' : 'transparent',
                          borderTop: idx > 0 ? '0.5px solid var(--border-light)' : 'none',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="avatar"
                            style={{ background: c.av_bg, color: c.av_cl, flexShrink: 0 }}
                          >
                            {ini(c.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 14, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.badges.join(' - ')}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.cnpj || c.meta}</div>
                            {vs.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {vs.map(v => (
                                  <span key={v.id}>
                                    <span style={{ marginRight: 2 }}>&#8596;</span>
                                    {v.linked_client?.name || v.linked_id}
                                    <span className="badge" style={{ marginLeft: 4, fontSize: 9 }}>{v.rels[0]}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                            {c.badges.map(b => (
                              <span key={b} className={`badge badge-${b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : b === 'Representante' ? 'rep' : 'repd'}`}>{b}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {groups.length === 0 && (
            <div className="empty">Nenhum cliente encontrado.</div>
          )}
        </div>
      </div>

      <div style={{ overflowY: 'auto', background: 'var(--bg-secondary)' }}>
        {selectedClient ? (
          <ClientPanel
            key={selectedClient.id}
            client={selectedClient}
            onEdit={() => openEdit(selectedClient)}
            onDelete={() => setConfirmDelete(selectedClient)}
            showToast={showToast}
            onReload={load}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: 8 }}>
            <span style={{ fontSize: 32 }}>&#128101;</span>
            <div style={{ fontWeight: 500 }}>Selecione um cliente</div>
            <div style={{ fontSize: 12 }}>Clique em um cliente na lista para ver os detalhes</div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '95vw' }}>
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Editar cliente' : 'Novo cliente'}</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label className="form-label">Nome completo *</label>
                <input
                  className="form-input"
                  placeholder="Nome do cliente"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label className="form-label">Classificacao</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['PF', 'PJ', 'Representante', 'Representado'] as Badge[]).map(b => {
                    const active = form.badges.includes(b)
                    const cls = b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : b === 'Representante' ? 'rep' : 'repd'
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            badges: active ? prev.badges.filter(x => x !== b) : [...prev.badges, b]
                          }))
                        }}
                        className={`badge badge-${cls}`}
                        style={{
                          cursor: 'pointer',
                          opacity: active ? 1 : 0.35,
                          padding: '6px 14px',
                          fontSize: 13,
                          border: active ? '2px solid currentColor' : '2px solid transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        {b}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.badges.includes('PF') && (
                <div className="form-field">
                  <label className="form-label">CPF</label>
                  <input
                    className="form-input"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={e => setForm({ ...form, cpf: e.target.value })}
                  />
                </div>
              )}

              {form.badges.includes('PJ') && (
                <div className="form-field">
                  <label className="form-label">CNPJ</label>
                  <input
                    className="form-input"
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={e => setForm({ ...form, cnpj: e.target.value })}
                  />
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Observacoes</label>
                <textarea
                  className="form-input form-textarea"
                  value={form.obs}
                  onChange={e => setForm({ ...form, obs: e.target.value })}
                  placeholder="Anotacoes internas sobre o cliente..."
                />
              </div>

              {showVinculosSection && (
                <div className="form-field">
                  <label className="form-label">Vinculos</label>

                  {(savedVinculos.length > 0 || pendingVinculos.length > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {savedVinculos.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: v.linked_client?.av_bg || '#ddd', color: v.linked_client?.av_cl || '#555' }}>
                            {ini(v.linked_client?.name || '?')}
                          </div>
                          <div style={{ flex: 1, fontSize: 13 }}>
                            <span style={{ fontWeight: 500 }}>{v.linked_client?.name || v.linked_id}</span>
                            <span style={{ marginLeft: 6, color: 'var(--text-secondary)', fontSize: 11 }}>{v.rels.join(', ')} &bull; {v.tipo === 'rep' ? 'Representante' : 'Representado'}</span>
                          </div>
                          <button
                            className="btn btn-icon btn-ghost"
                            style={{ width: 24, height: 24, fontSize: 12 }}
                            onClick={() => openEditVinculo(v)}
                            title="Editar vinculo"
                          >&#9998;</button>
                          <button
                            className="btn btn-icon btn-ghost"
                            style={{ width: 24, height: 24, fontSize: 12, color: 'var(--danger)' }}
                            onClick={() => handleRemoveSavedVinculo(v)}
                            title="Remover vinculo"
                          >&#10005;</button>
                        </div>
                      ))}
                      {pendingVinculos.map((pv, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                          <div style={{ flex: 1, fontSize: 13 }}>
                            <span style={{ fontWeight: 500 }}>{pv.linked_name}</span>
                            <span style={{ marginLeft: 6, color: 'var(--text-secondary)', fontSize: 11 }}>{pv.rels.join(', ')} &bull; {pv.tipo === 'rep' ? 'Representante' : 'Representado'}</span>
                          </div>
                          <button
                            className="btn btn-icon btn-ghost"
                            style={{ width: 24, height: 24, fontSize: 12 }}
                            onClick={() => openEditPending(i)}
                            title="Editar"
                          >&#9998;</button>
                          <button
                            className="btn btn-icon btn-ghost"
                            style={{ width: 24, height: 24, fontSize: 12, color: 'var(--danger)' }}
                            onClick={() => setPendingVinculos(prev => prev.filter((_, j) => j !== i))}
                            title="Remover"
                          >&#10005;</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!drawerOpen ? (
                    <button
                      className="btn btn-ghost"
                      style={{ width: '100%' }}
                      onClick={startNewVinculo}
                    >
                      + Adicionar vinculo
                    </button>
                  ) : (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: 14 }}>
                      {drawerStep === 1 && drawerMode === 'new' && (
                        <div>
                          <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 13 }}>Tipo de vinculo</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {(['rep', 'repd'] as TipoVinculo[]).map(t => (
                              <button
                                key={t}
                                className={`btn ${drawerTipo === t ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => { setDrawerTipo(t); setDrawerStep(2) }}
                              >
                                {t === 'rep' ? 'Representante' : 'Representado'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {drawerStep === 2 && drawerMode === 'new' && (
                        <div>
                          <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 13 }}>
                            Selecionar cliente ({drawerTipo === 'rep' ? 'Representante' : 'Representado'})
                          </div>
                          <input
                            className="form-input"
                            placeholder="Buscar cliente..."
                            value={drawerSearch}
                            onChange={e => setDrawerSearch(e.target.value)}
                            autoFocus
                          />
                          <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
                            {clients
                              .filter(c => !editingId || c.id !== editingId)
                              .filter(c => !drawerSearch || c.name.toLowerCase().includes(drawerSearch.toLowerCase()))
                              .map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => { setDrawerClientId(c.id); setDrawerStep(3) }}
                                  style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: c.av_bg, color: c.av_cl }}>{ini(c.name)}</div>
                                  <span style={{ fontSize: 13 }}>{c.name}</span>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}

                      {drawerStep === 3 && (
                        <div>
                          <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 13 }}>
                            {drawerMode === 'edit' ? 'Editar relacao' : 'Relacao'}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {[...RELS_OPTS, 'Outros'].map(r => {
                              const has = drawerRels.includes(r)
                              return (
                                <button
                                  key={r}
                                  className={`btn ${has ? 'btn-primary' : 'btn-ghost'}`}
                                  onClick={() => setDrawerRels(prev => has ? prev.filter(x => x !== r) : [...prev, r])}
                                >
                                  {r}
                                </button>
                              )
                            })}
                          </div>
                          {drawerRels.includes('Outros') && (
                            <input
                              className="form-input"
                              style={{ marginTop: 8 }}
                              placeholder="Especificar..."
                              value={drawerOutro}
                              onChange={e => setDrawerOutro(e.target.value)}
                            />
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              className="btn btn-primary"
                              disabled={drawerRels.length === 0}
                              onClick={confirmDrawer}
                            >
                              {drawerMode === 'edit' ? 'Salvar' : 'Confirmar'}
                            </button>
                            <button className="btn btn-ghost" onClick={closeDrawer}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingId ? 'Salvar alteracoes' : 'Cadastrar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Excluir cliente</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setConfirmDelete(null)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ color: '#DC2626', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>&#9888; Esta acao nao pode ser desfeita.</div>
                <div style={{ color: '#991B1B', fontSize: 13 }}>Todos os servicos e tarefas do cliente serao permanentemente excluidos.</div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Confirma a exclusao de <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong>?
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className="btn"
                style={{ background: '#DC2626', color: '#fff' }}
                onClick={handleDelete}
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
