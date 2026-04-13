'use client'
import { useState, useEffect, useCallback } from 'react'
import { getSubtasksByDate } from '@/lib/db'
import { MNS, pad, toISO, TIPO_LABEL } from '@/lib/utils'
import type { Subtask } from '@/lib/types'
import EventPanel from './EventPanel'

const DNS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
const TIPO_EV: Record<string, string> = {
  prev: 'ev-prev', contab: 'ev-contab', assessoria: 'ev-assess',
  cliente: 'ev-cliente', interno: 'ev-interno'
}

interface Props { showToast: (msg: string, type?: 'success' | 'danger') => void }

export default function CalendarView({ showToast }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState<Record<string, any[]>>({})
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [openCid, setOpenCid] = useState<string | null>(null)
  const today = toISO(now)

  const loadMonth = useCallback(async () => {
    const dim = new Date(year, month + 1, 0).getDate()
    const dates = Array.from({ length: dim }, (_, i) =>
      `${year}-${pad(month + 1)}-${pad(i + 1)}`
    )
    const all: Record<string, any[]> = {}
    await Promise.all(dates.map(async date => {
      try {
        const subs = await getSubtasksByDate(date)
        if (subs.length > 0) all[date] = subs
      } catch {}
    }))
    setEvents(all)
  }, [year, month])

  useEffect(() => { loadMonth() }, [loadMonth])

  function navigate(n: number) {
    let m = month + n, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  function buildGrid() {
    const firstDay = new Date(year, month, 1).getDay()
    const firstIdx = firstDay === 0 ? 6 : firstDay - 1
    const dim = new Date(year, month + 1, 0).getDate()
    const dip = new Date(year, month, 0).getDate()
    const cells = []
    for (let i = 0; i < firstIdx; i++)
      cells.push({ day: dip - firstIdx + 1 + i, iso: null, outside: true })
    for (let d = 1; d <= dim; d++) {
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`
      cells.push({ day: d, iso, outside: false })
    }
    const rem = (firstIdx + dim) % 7 === 0 ? 0 : 7 - ((firstIdx + dim) % 7)
    for (let i = 1; i <= rem; i++)
      cells.push({ day: i, iso: null, outside: true })
    return cells
  }

  const cells = buildGrid()

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
        <h2 style={{ fontSize:18, fontWeight:500 }}>{MNS[month]} {year}</h2>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>←</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(1)}>→</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', border:'0.5px solid var(--border-light)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {DNS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', padding:'8px 0', background:'var(--bg-secondary)', borderRight:'0.5px solid var(--border-light)', borderBottom:'0.5px solid var(--border-light)' }}>{d}</div>
        ))}
        {cells.map((cell, idx) => {
          const evs = cell.iso ? events[cell.iso] || [] : []
          const byClient: Record<string, any> = {}
          evs.forEach((e: any) => {
            const cid = e.service?.client_id || 'unknown'
            if (!byClient[cid]) byClient[cid] = { ...e, count: 0 }
            byClient[cid].count++
          })
          const entries = Object.entries(byClient)
          const isToday = cell.iso === today
          const isLast7n = (idx + 1) % 7 === 0

          return (
            <div
              key={idx}
              onClick={() => {
                if (!cell.iso || entries.length === 0) return
                setOpenCid(entries[0][0])
                setOpenDate(cell.iso)
              }}
              style={{
                minHeight: 110,
                padding: '9px 9px 7px',
                background: cell.outside ? 'var(--bg-secondary)' : isToday ? '#FAFAFF' : 'var(--bg-primary)',
                borderRight: isLast7n ? 'none' : '0.5px solid var(--border-light)',
                borderBottom: '0.5px solid var(--border-light)',
                cursor: entries.length > 0 ? 'pointer' : 'default',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                {isToday
                  ? <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--purple-600)', color:'var(--purple-50)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500 }}>{cell.day}</div>
                  : <span style={{ fontSize:13, fontWeight:500, color: cell.outside ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{cell.day}</span>
                }
                {entries.length > 0 && (
                  <span style={{ fontSize:9, fontWeight:500, color:'var(--purple-600)', background:'var(--purple-50)', padding:'1px 5px', borderRadius:10 }}>{entries.length}</span>
                )}
              </div>
              {entries.slice(0, 2).map(([cid, e]) => {
                const tipo = e.service?.tipo || 'interno'
                return (
                  <div key={cid} style={{ display:'flex', alignItems:'flex-start', gap:4, padding:'3px 5px', marginBottom:3, borderLeft:`2px solid ${tipo === 'prev' ? '#185FA5' : tipo === 'contab' ? '#534AB7' : tipo === 'assessoria' ? '#BA7517' : tipo === 'cliente' ? '#3B6D11' : '#888780'}`, borderRadius:'0 4px 4px 0', background: tipo === 'prev' ? '#E6F1FB' : tipo === 'contab' ? '#EEEDFE' : tipo === 'assessoria' ? '#FAEEDA' : tipo === 'cliente' ? '#EAF3DE' : 'var(--bg-secondary)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:9, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: tipo === 'prev' ? '#0C447C' : tipo === 'contab' ? '#3C3489' : tipo === 'assessoria' ? '#633806' : tipo === 'cliente' ? '#27500A' : 'var(--text-secondary)' }}>
                        {e.service?.clients?.name || 'Cliente'}
                      </div>
                      <div style={{ fontSize:8, opacity:0.7, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {e.service?.nome}
                      </div>
                    </div>
                  </div>
                )
              })}
              {entries.length > 2 && (
                <div style={{ fontSize:9, color:'var(--text-tertiary)', padding:'1px 4px' }}>+{entries.length - 2} mais</div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap' }}>
        {[['#185FA5','Previdenciário'],['#534AB7','Contabilidade'],['#BA7517','Cont. | Assessoria'],['#888780','Interno']].map(([color, label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
            <div style={{ width:10, height:4, borderRadius:2, background:color }}></div>{label}
          </div>
        ))}
      </div>

      {openDate && openCid && (
        <EventPanel
          date={openDate}
          clientId={openCid}
          onClose={() => { setOpenDate(null); setOpenCid(null) }}
          showToast={showToast}
          onRefresh={loadMonth}
        />
      )}
    </div>
  )
                  }
