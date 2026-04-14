'use client'
import { useState } from 'react'
import CalendarView from '@/components/CalendarView'
import TasksView from '@/components/TasksView'
import ClientsView from '@/components/ClientsView'
import TriagemManual from '@/components/TriagemManual'
import Toast from '@/components/Toast'

type Tab = 'cal' | 'tasks' | 'clients' | 'triagem'

export default function Home() {
  const [tab, setTab] = useState<Tab>('cal')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null)

  function showToast(msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">EM Escritório</div>
        <nav className="app-tabs">
          {(['cal', 'tasks', 'clients', 'triagem'] as Tab[]).map(t => (
            <button
              key={t}
              className={`app-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'cal' ? 'Calendário' : t === 'tasks' ? 'Tarefas' : t === 'clients' ? 'Clientes' : 'Triagem'}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-content">
        {tab === 'cal' && <CalendarView showToast={showToast} />}
        {tab === 'tasks' && <TasksView showToast={showToast} />}
        {tab === 'clients' && <ClientsView showToast={showToast} />}
        {tab === 'triagem' && <TriagemManual showToast={showToast} />}
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
