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

  const filtered = useMemo(() => clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.meta || '').includes(search)
  ), [clients, search])

  const groups = useMemo(() => {
    const placed = new Set<string>()
    const result: Client[][] = []
    filtered.forEach(client => {
      if (placed.has(client.id)) return
      const vinculos = vinculosByClient[client.id] || []
      const linkedIds = vinculos.map(v => v.linked_id)
      const linkedClients = filtered.filter(c => linkedIds.includes(c.id) && !placed.has(c.id))
      const group = [client, ...linkedClients]
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

  function openNew() {
    resetForm()
    setShowModal(true)
  }

  async function openEdit(c: Client) {
    setEditingId(c.id)
    const meta = c.meta || ''
    setForm({
      name: c.name,
      cpf: meta.includes('+') ? meta.split('+')[0].trim() : (meta === 'CPF' || meta === 'CPF + CNPJ' ? '' : meta),
      cnpj: c.cnpj || '',
      badges: c.badges || [],
      obs: c.obs || ''
    })
    const vs = vinculosByClient[c.id] || await getVinculos(c.id)
    setSavedVinculos(vs)
    setPendingVinculos([])
    setShowModal(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setDrawerStep(1)
    setDrawerTipo(null)
    setDrawerClientId(null)
    setDrawerRels([])
    setDrawerOutro('')
    setDrawerSearch('')
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
        await updateClient(editingId, payload)
        clientId = editingId
      } else {
        const created = await createClient(payload as any)
        clientId = created.id
      }
      for (const pv of pendingVinculos) {
        await createVinculoBidirecional(clientId, pv.linked_id, pv.rels, pv.tipo, pv.outro_val)
      }
      showToast(editingId ? 'Cliente atualizado' : 'Cliente cadastrado')
      setShowModal(false)
      resetForm()
      await load()
    } catch (e: any) {
      showToast('Erro ao salvar: ' + (e.message || e), 'danger')
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    try {
      await deleteClientCompleto(confirmDelete.id)
      showToast('Cliente excluído')
      setConfirmDelete(null)
      setSelectedId(null)
      await load()
    } catch (e: any) {
      showToast('Erro ao excluir: ' + (e.message || e), 'danger')
    }
  }

  function confirmDrawer() {
    if (!drawerTipo || !drawerClientId || drawerRels.length === 0) return
    const linked = clients.find(c => c.id === drawerClientId)
    if (!linked) return
    setPendingVinculos(prev => [...prev, {
      linked_id: drawerClientId,
      linked_name: linked.name,
      rels: drawerRels,
      tipo: drawerTipo,
      outro_val: drawerOutro || undefined
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

  const previewColor = form.name ? getColor(form.name) : { bg: '#e5e7eb', cl: '#64748b' }

  const selectedClient = selectedId ? clients.find(c => c.id === selectedId) : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={openNew} className="btn btn-primary">+ Novo cliente</button>
      </div>

      {groups.map((group, gi) => {
        const label = group.length > 1 ? group.map(c => c.name.split(' ')[0]).join(' + ') : null
        return (
          <div key={gi} style={{ marginBottom: 14 }}>
            {label && (
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, paddingLeft: 4 }}>
                👥 {label}
              </div>
            )}
            <div className="card" style={{ overflow: 'hidden' }}>
              {group.map((c, idx) => {
                const vs = vinculosByClient[c.id] || []
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: idx < group.length - 1 ? '1px solid var(--border-light, #f1f5f9)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.av_bg, color: c.av_cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                      {ini(c.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)' }}>{c.meta}</div>
                      {vs.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', marginTop: 2 }}>
                          {vs.map(v => `↔ ${v.linked_client?.name || ''} — ${(v.rels||[]).join(', ')}`).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(c.badges || []).map(b => (
                        <span key={b} className={badgeCls(b)}>{b}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary, #94a3b8)' }}>
          Nenhum cliente cadastrado
        </div>
      )}

      {selectedClient && (
        <ClientPanel
          client={selectedClient}
          onEdit={() => { setSelectedId(null); openEdit(selectedClient) }}
          onDelete={() => { setConfirmDelete(selectedClient); setSelectedId(null) }}
          showToast={showToast}
        />
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editingId ? 'Editar cliente' : 'Novo cliente'}</div>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary, #64748b)' }}>✕</button>
            </div>

            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-soft, #f8fafc)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: previewColor.bg, color: previewColor.cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600 }}>
                {form.name ? ini(form.name) : '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{form.name || 'Nome do cliente'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)' }}>{metaLabel()}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {form.badges.map(b => <span key={b} className={badgeCls(b)}>{b}</span>)}
              </div>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="label">NOME COMPLETO</div>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Maria Silva" />
              </div>

              <div>
                <div className="label">CPF</div>
                <input type="text" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
              </div>

              {form.badges.includes('PJ') && (
                <div>
                  <div className="label">CNPJ</div>
                  <input type="text" value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                </div>
              )}

              <div>
                <div className="label">CLASSIFICAÇÃO</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['PF','PJ','Representante'] as Badge[]).map(b => (
                    <button key={b} type="button" onClick={() => toggleBadge(b)} className={form.badges.includes(b) ? badgeCls(b) + ' badge-active' : 'badge-inactive'} style={{ cursor: 'pointer', border: form.badges.includes(b) ? '1px solid currentColor' : '1px solid var(--border, #e2e8f0)', padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 500 }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label">OBSERVAÇÕES</div>
                <textarea value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} rows={3} placeholder="Anotações internas sobre o cliente..." />
              </div>

              <div>
                <div className="label">VÍNCULOS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {savedVinculos.map(v => (
                    <div key={v.id} style={{ padding: '8px 12px', background: 'var(--purple-50, #faf5ff)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{v.linked_client?.name}</span>
                      <span style={{ color: 'var(--text-secondary, #64748b)' }}>— {(v.rels || []).join(', ')}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--purple-600, #7c3aed)', fontWeight: 500 }}>
                        {v.tipo === 'rep' ? 'Representante' : 'Representado'}
                      </span>
                    </div>
                  ))}
                  {pendingVinculos.map((v, i) => (
                    <div key={'p'+i} style={{ padding: '8px 12px', background: 'var(--purple-50, #faf5ff)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed var(--purple-300, #d8b4fe)' }}>
                      <span style={{ fontWeight: 500 }}>{v.linked_name}</span>
                      <span style={{ color: 'var(--text-secondary, #64748b)' }}>— {v.rels.join(', ')}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--purple-600, #7c3aed)', fontWeight: 500 }}>
                        {v.tipo === 'rep' ? 'Representante' : 'Representado'}
                      </span>
                      <button onClick={() => setPendingVinculos(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary, #94a3b8)', fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                  {!drawerOpen && (
                    <button type="button" onClick={() => setDrawerOpen(true)} style={{ padding: '10px', border: '1px dashed var(--border, #e2e8f0)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary, #64748b)', textAlign: 'center' }}>
                      + Vincular a cliente existente
                    </button>
                  )}
                </div>
              </div>

              {drawerOpen && (
                <div style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 14, background: 'var(--bg-soft, #f8fafc)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary, #64748b)' }}>
                    {drawerStep === 1 && 'Passo 1 — Tipo de vínculo'}
                    {drawerStep === 2 && 'Passo 2 — Escolher cliente'}
                    {drawerStep === 3 && 'Passo 3 — Classificar relação'}
                  </div>

                  {drawerStep === 1 && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      {(['rep', 'repd'] as TipoVinculo[]).map(t => (
                        <button key={t} type="button" onClick={() => { setDrawerTipo(t); setDrawerStep(2) }} style={{ flex: 1, padding: '14px 10px', border: drawerTipo === t ? '2px solid var(--purple-500, #a855f7)' : '1px solid var(--border, #e2e8f0)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                          <div style={{ fontWeight: 600 }}>{t === 'rep' ? 'Representante' : 'Representado'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                            {t === 'rep' ? 'Age em nome de outro' : 'É representado por outro'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {drawerStep === 2 && (
                    <div>
                      <input type="text" placeholder="Buscar cliente..." value={drawerSearch} onChange={e => setDrawerSearch(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
                      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {drawerClients.map(c => (
                          <button key={c.id} type="button" onClick={() => { setDrawerClientId(c.id); setDrawerStep(3) }} style={{ padding: '8px 10px', border: drawerClientId === c.id ? '2px solid var(--purple-500, #a855f7)' : '1px solid var(--border, #e2e8f0)', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.av_bg, color: c.av_cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{ini(c.name)}</div>
                            <span style={{ flex: 1 }}>{c.name}</span>
                            {drawerClientId === c.id && <span style={{ color: 'var(--purple-600, #7c3aed)' }}>✓</span>}
                          </button>
                        ))}
                        {drawerClients.length === 0 && (
                          <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary, #94a3b8)' }}>Nenhum cliente disponível</div>
                        )}
                      </div>
                    </div>
                  )}

                  {drawerStep === 3 && (
                    <div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {RELS_OPTS.map(r => {
                          const active = drawerRels.includes(r)
                          return (
                            <button key={r} type="button" onClick={() => {
                              if (drawerTipo === 'repd') {
                                setDrawerRels(active ? [] : [r])
                              } else {
                                setDrawerRels(prev => active ? prev.filter(x => x !== r) : [...prev, r])
                              }
                            }} style={{ padding: '6px 12px', border: active ? '2px solid var(--purple-500, #a855f7)' : '1px solid var(--border, #e2e8f0)', borderRadius: 16, background: active ? 'var(--purple-50, #faf5ff)' : 'white', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                              {r}
                            </button>
                          )
                        })}
                        <button type="button" onClick={() => setDrawerRels(prev => prev.includes('Outros') ? prev.filter(x => x !== 'Outros') : (drawerTipo === 'repd' ? ['Outros'] : [...prev, 'Outros']))} style={{ padding: '6px 12px', border: drawerRels.includes('Outros') ? '2px solid var(--purple-500, #a855f7)' : '1px dashed var(--border, #e2e8f0)', borderRadius: 16, background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          + Outros
                        </button>
                      </div>
                      {drawerRels.includes('Outros') && (
                        <input type="text" placeholder="Descreva a relação..." value={drawerOutro} onChange={e => setDrawerOutro(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
                      )}
                      {drawerRels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {drawerRels.map(r => (
                            <span key={r} style={{ padding: '3px 8px', background: 'var(--purple-100, #f3e8ff)', color: 'var(--purple-700, #6b21a8)', borderRadius: 10, fontSize: 10, fontWeight: 500 }}>{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3].map(n => (
                        <span key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= drawerStep ? 'var(--purple-500, #a855f7)' : 'var(--border, #e2e8f0)' }} />
                      ))}
                    </div>
                    <button type="button" onClick={closeDrawer} style={{ marginLeft: 'auto', padding: '6px 12px', background: 'transparent', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
                    <button type="button" disabled={!drawerTipo || !drawerClientId || drawerRels.length === 0} onClick={confirmDrawer} style={{ padding: '6px 12px', background: 'var(--purple-500, #a855f7)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', opacity: (!drawerTipo || !drawerClientId || drawerRels.length === 0) ? 0.5 : 1 }}>Adicionar</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light, #f1f5f9)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setShowModal(false); resetForm() }} className="btn btn-secondary">Cancelar</button>
              <button onClick={saveClient} className="btn btn-primary">{editingId ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Excluir cliente</div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>Confirmar exclusão de <strong>{confirmDelete.name}</strong>?</div>
              <div style={{ fontSize: 12, color: '#dc2626', padding: 8, background: '#fef2f2', borderRadius: 6 }}>⚠ Esta ação não pode ser desfeita.</div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-light, #f1f5f9)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={doDelete} style={{ padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Excluir cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
