'use client'
// components/TriagemManual.tsx

import { useState } from 'react'

interface ResultadoTriagem {
  sucesso: boolean
  dados?: any
  tarefasFormatadas?: string[]
  resumo?: {
    cliente: string
    totalTarefas: number
    totalDocumentos: number
    totalVinculos: number
    clienteNovo: boolean
  }
  erro?: string
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'danger') => void
}

export default function TriagemManual({ showToast }: Props) {
  const [conversa, setConversa] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoTriagem | null>(null)
  const [modo, setModo] = useState<'colar' | 'ticket'>('colar')

  async function processar() {
    if (modo === 'colar' && !conversa.trim()) {
      showToast('Cole a conversa antes de processar', 'danger')
      return
    }
    if (modo === 'ticket' && !ticketId.trim()) {
      showToast('Informe o ID do ticket', 'danger')
      return
    }
    setLoading(true)
    setResultado(null)
    try {
      const body = modo === 'colar' ? { conversa } : { ticketId }
      const res = await fetch('/api/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResultado(data)
      if (data.sucesso) {
        const n = data.resumo?.totalTarefas || data.tarefasCriadas || 0
        showToast(n + ' tarefa(s) gerada(s)!')
      } else {
        showToast(data.erro || 'Erro ao processar', 'danger')
      }
    } catch (err) {
      showToast('Erro de conexao', 'danger')
    } finally {
      setLoading(false)
    }
  }

  function limpar() {
    setConversa('')
    setTicketId('')
    setResultado(null)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Triagem Manual</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Cole uma conversa do WhatsApp ou informe o ID do ticket para gerar tarefas automaticamente.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
        {(['colar', 'ticket'] as const).map(m => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`btn ${modo === m ? 'btn-primary' : 'btn-secondary'}`}
          >
            {m === 'colar' ? 'Colar conversa' : 'ID do ticket'}
          </button>
        ))}
      </div>
      {modo === 'colar' ? (
        <div className="form-field">
          <label className="form-label">Conversa do WhatsApp / Whaticket</label>
          <textarea
            className="form-input"
            style={{ height: 200, resize: 'vertical', lineHeight: 1.6 }}
            placeholder="Cole aqui a conversa do WhatsApp..."
            value={conversa}
            onChange={e => setConversa(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {conversa.length} caracteres
          </div>
        </div>
      ) : (
        <div className="form-field">
          <label className="form-label">ID do Ticket no Whaticket</label>
          <input
            className="form-input"
            placeholder="Ex: e422180a-f68f-432c-92d1-6d2d88112a39"
            value={ticketId}
            onChange={e => setTicketId(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Encontre o ID na URL do Whaticket
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={processar}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Processando com IA...' : 'Gerar tarefas'}
        </button>
        {(conversa || ticketId || resultado) && (
          <button className="btn btn-ghost" onClick={limpar}>Limpar</button>
        )}
      </div>
      {resultado && resultado.sucesso && resultado.resumo && (
        <div>
          <div style={{
            background: 'var(--green-50)',
            border: '0.5px solid #97C459',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green-800)', marginBottom: 8 }}>
              Triagem concluida
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                ['Cliente', resultado.resumo.cliente],
                ['Tarefas geradas', String(resultado.resumo.totalTarefas)],
                ['Documentos identificados', String(resultado.resumo.totalDocumentos)],
                ['Vinculos identificados', String(resultado.resumo.totalVinculos)],
              ].map(([label, val]) => (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}: </span>
                  <strong style={{ color: 'var(--green-800)' }}>{val}</strong>
                </div>
              ))}
            </div>
            {resultado.resumo.clienteNovo && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#3B6D11', background: '#C0DD97', padding: '3px 8px', borderRadius: 10, display: 'inline-block' }}>
                Novo cliente identificado
              </div>
            )}
          </div>
          {resultado.tarefasFormatadas && resultado.tarefasFormatadas.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Tarefas geradas
              </div>
              {resultado.tarefasFormatadas.map((tarefa, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-light)',
                  borderLeft: '3px solid var(--purple-600)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  marginBottom: 8,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap'
                }}>
                  {tarefa}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {resultado && !resultado.sucesso && (
        <div style={{
          background: 'var(--red-50)',
          border: '0.5px solid #F09595',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          fontSize: 13,
          color: 'var(--red-600)'
        }}>
          Erro: {resultado.erro}
        </div>
      )}
    </div>
  )
}
