'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClients, createClient, updateClient, deleteClient, getVinculos, createVinculo, deleteVinculo, deleteVinculosByClient } from '@/lib/db'
import { ini, getColor, badgeCls } from '@/lib/utils'
import type { Client, Vinculo, Badge } from '@/lib/types'

interface Props { showToast: (msg: string, type?: 'success' | 'danger') => void }
export default function ClientsView({ showToast }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState({ name:'', meta:'', badges:[] as string[], obs:'', av_bg:'#EEEDFE', av_cl:'#3C3489' })
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [showVincPicker, setShowVincPicker] = useState(false)

  const load = useCallback(async () => {
    const list = await getClients()
    setClients(list)
  }, [])

  useEffect(() => { load() }, [load])


  function openNew() {
    setEditingClient(null)
    setVinculos([])
    const color = getColor('A')
    setForm({ name:'', meta:'', badges:[], obs:'', av_bg: color.bg, av_cl: color.cl })
    setShowModal(true)
  }

  async function openEdit(c: Client) {
    setEditingClient(c)
    setForm({ name: c.name, meta: c.meta, badges: [...c.badges], obs: c.obs || '', av_bg: c.av_bg, av_cl: c.av_cl })
    const v = await getVinculos(c.id)
    setVinculos(v)
    setShowModal(true)
  }

  function toggleBadge(b: Badge) {
    setForm(p => {
      const badges = p.badges.includes(b) ? p.badges.filter(x => x !== b) : [...p.badges, b]
      return { ...p, badges }
    })
  }

  async function save() {
    if (!form.name.trim()) return
    const color = getColor(form.name)
    if (editingClient) {
      await updateClient(editingClient.id, { ...form, badges: form.badges as any, av_bg: color.bg, av_cl: color.cl })
      showToast(`${form.name} atualizado!`)
    } else {
      await createClient({ ...form, badges: form.badges as any, av_bg: color.bg, av_cl: color.cl })
      showToast(`${form.name} cadastrado!`)
    }
    setShowModal(false)
    load()
  }

  async function addVinculo(linkedId: string) {
    if (!editingClient) return
    const v = await createVinculo({ client_id: editingClient.id, linked_id: linkedId, rels: [], tipo: 'rep' })
    setVinculos(prev => [...prev, v])
    setShowVincPicker(false)
  }

  async function removeVinculo(vid: string) {
    await deleteVinculo(vid)
    setVinculos(prev => prev.filter(v => v.id !== vid))
  }

  async function confirmDelete() {
    if (!confirmId) return
    const c = clients.find(x => x.id === confirmId)
    await deleteVinculosByClient(confirmId)
    await deleteClient(confirmId)
    setShowConfirm(false)
    setConfirmId(null)
    if (selectedId === confirmId) setSelectedId(null)
    showToast(`${c?.name} excluído.`, 'danger')
    load()
  }
  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem' }}>
        <input className='form-input' placeholder='Buscar cliente...' value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1 }} />
        <button className='btn btn-primary' onClick={openNew}>+ Novo cliente</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>Nenhum cliente encontrado.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' }}>
          {filtered.map(c => (
            <div key={c.id} className='card' onClick={() => openEdit(c)} style={{ cursor:'pointer', padding:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className='avatar avatar-lg' style={{ background: c.av_bg, color: c.av_cl }}>{ini(c.name) || '?'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{c.meta || 'CPF'}</div>
                </div>
              </div>
              {c.badges.length > 0 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10 }}>
                  {c.badges.map(b => <span key={b} className={badgeCls(b)}>{b}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <div className='modal-overlay' onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className='modal-box'>
            <div className='modal-header'>
              <div className='modal-title'>{editingClient ? 'Editar cliente' : 'Novo cliente'}</div>
              <button className='btn btn-icon btn-ghost' onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className='modal-body'>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'1rem', background:'var(--bg-secondary)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border-light)' }}>
                <div className='avatar avatar-lg' style={{ background: getColor(form.name).bg, color: getColor(form.name).cl }}>{ini(form.name) || '?'}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:500 }}>{form.name || 'Nome do cliente'}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{form.meta || (form.badges.includes('PJ') ? 'CNPJ' : 'CPF')}</div>
                </div>
              </div>

              <div className='form-field'>
                <label className='form-label'>Nome completo</label>
                <input className='form-input' placeholder='Ex: Marina Costa' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div className='form-field'>
                <label className='form-label'>{form.badges.includes('PJ') ? 'CNPJ' : 'CPF'}</label>
                <input className='form-input' placeholder={form.badges.includes('PJ') ? '00.000.000/0000-00' : '000.000.000-00'} value={form.meta} onChange={e => setForm(p => ({ ...p, meta: e.target.value }))} />
              </div>

              <div className='form-field'>
                <label className='form-label'>Classificação</label>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                  {(['PF','PJ','Representante'] as Badge[]).map((label) => {
                    const on = form.badges.includes(label)
                    return (
                      <div key={label} onClick={() => toggleBadge(label)} style={{ padding:'7px 14px', border:`0.5px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, borderRadius:10, cursor:'pointer', background: on ? 'var(--accent-light)' : 'transparent', fontSize:13, fontWeight: on ? 600 : 400 }}>{label}</div>
                    )
                  })}
                </div>
              </div>

              <div className='form-field'>
                <label className='form-label'>Observações</label>
                <textarea className='form-input' rows={3} placeholder='Informações relevantes...' value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} />
              </div>
              <div className='form-field'>
                <label className='form-label'>Vínculos</label>
                {vinculos.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                    {vinculos.map(v => {
                      const lc = clients.find(c => c.id === v.linked_id)
                      return (
                        <div key={v.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'0.5px solid var(--border-light)', borderRadius:8 }}>
                          <div className='avatar' style={{ background: lc?.av_bg || '#EEE', color: lc?.av_cl || '#333' }}>{ini(lc?.name || '?')}</div>
                          <div style={{ flex:1, fontSize:13 }}>{lc?.name || 'Cliente'}</div>
                          <button className='btn btn-icon btn-ghost' onClick={() => removeVinculo(v.id)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {showVincPicker ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflowY:'auto', border:'0.5px solid var(--border-light)', borderRadius:8, padding:6 }}>
                    {clients.filter(c => c.id !== editingClient?.id && !vinculos.find(v => v.linked_id === c.id)).map(c => (
                      <div key={c.id} onClick={() => addVinculo(c.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', cursor:'pointer', borderRadius:6 }}>
                        <div className='avatar' style={{ background: c.av_bg, color: c.av_cl }}>{ini(c.name)}</div>
                        <div style={{ fontSize:13 }}>{c.name}</div>
                      </div>
                    ))}
                    <button className='btn btn-ghost' onClick={() => setShowVincPicker(false)} style={{ marginTop:4 }}>Cancelar</button>
                  </div>
                ) : (
                  <div onClick={() => editingClient && setShowVincPicker(true)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px', border:'0.5px dashed var(--border-medium)', borderRadius:10, cursor: editingClient ? 'pointer' : 'not-allowed', opacity: editingClient ? 1 : 0.5 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'var(--text-secondary)' }}>+</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500 }}>Vincular a cliente existente</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{editingClient ? 'Você pode adicionar quantos vínculos precisar' : 'Salve o cliente primeiro para adicionar vínculos'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className='modal-footer'>
              {editingClient && (
                <button className='btn btn-danger' onClick={() => { setConfirmId(editingClient.id); setShowConfirm(true) }}>Excluir</button>
              )}
              <div style={{ flex:1 }} />
              <button className='btn btn-ghost' onClick={() => setShowModal(false)}>Cancelar</button>
              <button className='btn btn-primary' onClick={save}>{editingClient ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className='modal-overlay' onClick={() => setShowConfirm(false)}>
          <div className='modal-box' style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className='modal-header'><div className='modal-title'>Excluir cliente?</div></div>
            <div className='modal-body'>Essa ação não pode ser desfeita.</div>
            <div className='modal-footer'>
              <button className='btn btn-ghost' onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className='btn btn-danger' onClick={() => { confirmDelete(); setShowModal(false) }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
