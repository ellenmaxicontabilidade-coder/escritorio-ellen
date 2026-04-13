'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClients, createClient, updateClient, deleteClient, getVinculos, createVinculo, deleteVinculosByClient } from '@/lib/db'
import { ini, getColor, badgeCls } from '@/lib/utils'
import type { Client, Vinculo, Badge } from '@/lib/types'
import ClientPanel from './ClientPanel'

interface Props { showToast: (msg: string, type?: 'success' | 'danger') => void }

export default function ClientsView({ showToast }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState({ name:'', meta:'CPF', badges:[] as Badge[], obs:'', av_bg:'#EEEDFE', av_cl:'#3C3489' })
  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try { setClients(await getClients()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = search
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients

  function openNew() {
    setEditingClient(null)
    setVinculos([])
    const color = getColor('A')
    setForm({ name:'', meta:'CPF', badges:[], obs:'', av_bg: color.bg, av_cl: color.cl })
    setShowModal(true)
  }

  async function openEdit(c: Client) {
    setEditingClient(c)
    setForm({ name: c.name, meta: c.meta, badges: [...c.badges], obs: c.obs || '', av_bg: c.av_bg, av_cl: c.av_cl })
    const v = await getVinculos(c.id)
    setVinculos(v)
    setShowModal(true)
  }

  function toggleBadge(b: string) {
    setForm(p => {
      const has = p.badges.includes(b)
      const badges = has ? p.badges.filter(x => x !== b) : [...p.badges, b]
      const hasPJ = badges.includes('PJ')
      return { ...p, badges, meta: hasPJ ? 'CPF + CNPJ' : 'CPF' }
    })
  }

  async function save() {
    if (!form.name.trim()) return
    const color = getColor(form.name)
    if (editingClient) {
      await updateClient(editingClient.id, { ...form, av_bg: color.bg, av_cl: color.cl })
      showToast(`${form.name} atualizado!`)
    } else {
      await createClient({ ...form, av_bg: color.bg, av_cl: color.cl })
      showToast(`${form.name} cadastrado!`)
    }
    setShowModal(false)
    load()
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

  const selected = selectedId ? clients.find(c => c.id === selectedId) : null

  return (
    <div style={{ display:'flex', gap:'1.5rem' }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', alignItems:'center' }}>
          <input className="form-input" style={{ flex:1 }} placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={openNew}>+ Novo cliente</button>
        </div>

        {loading ? <div className="loading"><div className="spinner"></div>Carregando...</div>
          : displayed.length === 0 ? <div className="empty">Nenhum cliente encontrado.</div>
          : (
            <div className="card">
              {displayed.map((c, i) => (
                <div key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)} style={{ padding:'12px 14px', cursor:'pointer', background: c.id === selectedId ? 'var(--purple-50)' : 'var(--bg-primary)', transition:'background .12s', borderBottom: i < displayed.length-1 ? '0.5px solid var(--border-light)' : 'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="avatar avatar-md" style={{ background: c.av_bg, color: c.av_cl }}>{ini(c.name)}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:500 }}>{c.name}</div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{c.meta}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', flexShrink:0 }}>
                      {c.badges.map(b => <span key={b} className={`badge badge-${b === 'PF' ? 'pf' : b === 'PJ' ? 'pj' : 'rep'}`}>{b}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {selected && (
        <div style={{ width: 'min(400px, 40%)', flexShrink:0 }}>
          <ClientPanel
            client={selected}
            onEdit={() => openEdit(selected)}
            onDelete={() => { setConfirmId(selected.id); setShowConfirm(true) }}
            showToast={showToast}
          />
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">{editingClient ? 'Editar cliente' : 'Novo cliente'}</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'1rem', background:'var(--bg-secondary)', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--border-light)' }}>
                <div className="avatar avatar-lg" style={{ background: getColor(form.name).bg, color: getColor(form.name).cl }}>{ini(form.name) || '?'}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:500 }}>{form.name || 'Nome do cliente'}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{form.meta}</div>
                </div>
              </div>
              <div className="form-field"><label className="form-label">Nome completo</label><input className="form-input" placeholder="Ex: Marina Costa" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="form-field"><label className="form-label">Classificação</label>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                  {[['pf','PF','#E6F1FB','#0C447C','#85B7EB'],['pj','PJ','#FAEEDA','#633806','#EF9F27'],['rep','Representante','#EAF3DE','#27500A','#97C459']].map(([k,l,bg,cl,bc]) => {
                    const label = k === 'rep' ? 'Representante' : l
                    const on = form.badges.includes(label)
                    return <div key={k} onClick={() => toggleBadge(label)} style={{ padding:'7px 14px', border:`0.5px solid ${on ? bc : 'var(--border-medium)'}`, borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:500, background: on ? bg : 'var(--bg-secondary)', color: on ? cl : 'var(--text-secondary)' }}>{label}</div>
                  })}
                </div>
              </div>
              <div className="form-field"><label className="form-label">Observações</label><textarea className="form-input form-textarea" placeholder="Informações relevantes..." value={form.obs} onChange={e => setForm(p => ({...p, obs: e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editingClient ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ padding:'1.5rem' }}>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:'.5rem' }}>Excluir cliente</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:'1rem' }}>
              Tem certeza que deseja excluir <strong>{clients.find(c => c.id === confirmId)?.name}</strong>?
              <div style={{ marginTop:'.5rem', fontSize:11, color:'var(--red-600)', padding:'8px 10px', background:'var(--red-50)', borderRadius:'var(--radius-md)' }}>Esta ação não pode ser desfeita.</div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="btn" style={{ background:'var(--red-600)', color:'#fff', border:'none' }} onClick={confirmDelete}>Excluir cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
          }
