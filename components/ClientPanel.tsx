'use client'
import { useState, useEffect, useRef } from 'react'
import { 
          getServicesByClient, 
          getSubtasksByService, 
          getCommentsBySubtask, 
          toggleSubtaskWithSync, 
          createComment, 
          createSubtask, 
          getVinculos,
          createService,
          updateService,
          deleteService,
          updateSubtask,
          deleteSubtask,
          getChecklistItemsBySubtask,
          createChecklistItem,
          updateChecklistItem,
          deleteChecklistItem
} from '@/lib/db'
import { ini, fmtDate, nowStr } from '@/lib/utils'
import type { Client, Service, Subtask, Comment, Vinculo, ChecklistItem, Responsavel, AreaServico } from '@/lib/types'

const AREAS_SERVICO: AreaServico[] = [
          'Contabilidade',
          'Previdenciário',
          'Outros',
          'DEFIS',
          'Declaração MEI',
          'Assessoria',
          'IRPF',
          'COMERCIAL',
          'ADVBOX',
          'COMPRAS INTERNO',
          'METAS',
          'CERTIFICADO DIGITAL',
          'FINANCEIRO - CLIENTES - INADIMPLENCIA',
          'INTERNO',
        ]

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
          const [checklistItems, setChecklistItems] = useState<Record<string, ChecklistItem[]>>({})
          const [vinculos, setVinculos] = useState<Vinculo[]>([])
          const [loading, setLoading] = useState(true)
          const [openSvc, setOpenSvc] = useState<string[]>([])
          const [openTask, setOpenTask] = useState<string[]>([])
          const [openCmt, setOpenCmt] = useState<string[]>([])
          const [newComment, setNewComment] = useState<Record<string, string>>({})
          const [addFormSvc, setAddFormSvc] = useState<string | null>(null)
          const [editFormSvc, setEditFormSvc] = useState<Service | null>(null)
          const [addFormTask, setAddFormTask] = useState<string | null>(null)
          const [editFormTask, setEditFormTask] = useState<Subtask | null>(null)
          const [addFormChecklist, setAddFormChecklist] = useState<string | null>(null)
          const [editFormChecklist, setEditFormChecklist] = useState<ChecklistItem | null>(null)
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
              document.addEventListener('click', handleClick)
              return () => document.removeEventListener('click', handleClick)
  }, [])

  async function load() {
              try {
                            setLoading(true)
                            const [servicesData, vinculosData] = await Promise.all([
                                            getServicesByClient(client.id),
                                            getVinculos(client.id)
                                          ])
                            setServices(servicesData)
                            setVinculos(vinculosData)

                // Load subtasks for each service
                const subtasksData: Record<string, Subtask[]> = {}
                              const commentsData: Record<string, Comment[]> = {}
                                            const checklistData: Record<string, ChecklistItem[]> = {}

                                                          for (const service of servicesData) {
                                                                          const serviceTasks = await getSubtasksByService(service.id)
                                                                          subtasksData[service.id] = serviceTasks

                              for (const task of serviceTasks) {
                                                const taskComments = await getCommentsBySubtask(task.id)
                                                commentsData[task.id] = taskComments

                                                                            const checklist = await getChecklistItemsBySubtask(task.id)
                                                checklistData[task.id] = checklist
                              }
                                                          }

                setSubtasks(subtasksData)
                            setComments(commentsData)
                            setChecklistItems(checklistData)
              } catch (err: any) {
                            showToast(err.message, 'danger')
              } finally {
                            setLoading(false)
              }
  }

  useEffect(() => { load() }, [client.id])

  async function toggleSub(sub: Subtask) {
              await toggleSubtaskWithSync(sub.id, !sub.done)
              await load()
  }

  async function sendComment(subId: string) {
              const text = newComment[subId]?.trim()
              if (!text) return
              await createComment({
                            subtask_id: subId,
                            author: 'Sistema',
                            av: '👤',
                            init: '👤',
                            text,
                            dt: nowStr()
              })
              setNewComment(prev => ({ ...prev, [subId]: '' }))
              await load()
  }

  async function saveSubtask(svId: string) {
              const form = document.getElementById(`addForm-${svId}`) as HTMLFormElement
              const data = new FormData(form)
              await createSubtask({
                            service_id: svId,
                            title: data.get('title') as string,
                            done: false,
                            resp: data.get('resp') as Responsavel,
                            date: data.get('date') as string,
                            time: data.get('time') as string,
                            anotacoes: data.get('anotacoes') as string
              })
              setAddFormSvc(null)
              await load()
  }

  async function saveService(clientId: string) {
              const form = document.getElementById('addServiceForm') as HTMLFormElement
              const data = new FormData(form)
              await createService({
                            client_id: clientId,
                            nome: data.get('nome') as string,
                            tipo: 'contab',
                            responsavel: data.get('responsavel') as Responsavel,
                            area: data.get('area') as AreaServico,
                            status_atendimento: data.get('status_atendimento') as string
              })
              setAddFormSvc(null)
              await load()
  }

  async function updateServiceData(service: Service) {
              const form = document.getElementById('editServiceForm') as HTMLFormElement
              const data = new FormData(form)
              await updateService(service.id, {
                            nome: data.get('nome') as string,
                            responsavel: data.get('responsavel') as Responsavel,
                            area: data.get('area') as AreaServico,
                            status_atendimento: data.get('status_atendimento') as string
              })
              setEditFormSvc(null)
              await load()
  }

  async function updateTaskData(task: Subtask) {
              const form = document.getElementById('editTaskForm') as HTMLFormElement
              const data = new FormData(form)
              await updateSubtask(task.id, {
                            title: data.get('title') as string,
                            resp: data.get('resp') as Responsavel,
                            date: data.get('date') as string,
                            time: data.get('time') as string,
                            anotacoes: data.get('anotacoes') as string
              })
              setEditFormTask(null)
              await load()
  }

  async function deleteServiceConfirm(service: Service) {
              if (confirm(`Excluir serviço "${service.nome}" e todas suas tarefas?`)) {
                            await deleteService(service.id)
                            await load()
                            showToast('Serviço excluído', 'success')
              }
  }

  async function deleteTaskConfirm(task: Subtask) {
              if (confirm(`Excluir tarefa "${task.title}"?`)) {
                            await deleteSubtask(task.id)
                            await load()
                            showToast('Tarefa excluída', 'success')
              }
  }

  async function saveChecklistItem(taskId: string) {
              const form = document.getElementById('addChecklistForm') as HTMLFormElement
              const data = new FormData(form)
              await createChecklistItem({
                            subtask_id: taskId,
                            descricao: data.get('descricao') as string,
                            anotacoes: data.get('anotacoes') as string,
                            done: false
              })
              setAddFormChecklist(null)
              await load()
  }

  async function updateChecklistItemData(item: ChecklistItem) {
              const form = document.getElementById('editChecklistForm') as HTMLFormElement
              const data = new FormData(form)
              await updateChecklistItem(item.id, {
                            descricao: data.get('descricao') as string,
                            anotacoes: data.get('anotacoes') as string
              })
              setEditFormChecklist(null)
              await load()
  }

  async function toggleChecklistItem(item: ChecklistItem) {
              await updateChecklistItem(item.id, { done: !item.done })
              await load()
  }

  async function deleteChecklistConfirm(item: ChecklistItem) {
              if (confirm(`Excluir subtarefa "${item.descricao}"?`)) {
                            await deleteChecklistItem(item.id)
                            await load()
                            showToast('Subtarefa excluída', 'success')
              }
  }

  function papelVinculo(linked: any): string {
              if (!linked) return ''
              return linked.tipo === 'rep' ? 'Representante' : 'Representado'
  }

  function pendLabel(n: number): string {
              return n === 0 ? '0' : n === 1 ? '1' : n.toString()
  }

  const totalPending = services.reduce((acc, svc) => {
              return acc + (subtasks[svc.id]?.filter(t => !t.done).length || 0) + 
                            Object.values(checklistItems).flat().filter(ci => !ci.done).length
  }, 0)

  const totalCompleted = services.reduce((acc, svc) => {
              return acc + (subtasks[svc.id]?.filter(t => t.done).length || 0) + 
                            Object.values(checklistItems).flat().filter(ci => ci.done).length
  }, 0)

  if (loading) {
              return (
                            <div className="card border-0 shadow-sm">
                                    <div className="card-body text-center py-4">
                                              <div className="spinner-border text-primary" role="status">
                                                          <span className="visually-hidden">Carregando...</span
                                              </div>div>
                                    </div>div>
                            </div>div>
                          )
  }
        
          return (
                      <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-bottom-0 d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-3">
                                              <div 
                                                                  className="rounded-circle d-flex align-items-center justify-content-center" 
                                                style={{
                                                                      width: '48px', 
                                                                      height: '48px',
                                                                      backgroundColor: client.av_bg,
                                                                      color: client.av_cl,
                                                                      fontSize: '18px',
                                                                      fontWeight: 'bold'
                                                }}
                                                                >
                                                      {ini(client.name)}
                                              </div>div>
                                              <div>
                                                          <h5 className="mb-1">{client.name}</h5>h5>
                                                          <div className="d-flex gap-2 mb-1">
                                                                  {client.badges.map(badge => (
                                              <span 
                                                                        key={badge}
                                                                        className={`badge ${
                                                                                                    badge === 'PF' ? 'bg-success' : 
                                                                                                    badge === 'PJ' ? 'bg-primary' :
                                                                                                    badge === 'Representante' ? 'bg-info' : 'bg-secondary'
                                                                        }`}
                                                                      >
                                                      {badge}
                                              </span>span>
                                            ))}
                                                          </div>div>
                                              </div>div>
                                    </div>div>
                                    
                                    <div className="position-relative" ref={dotsRef}>
                                              <button 
                                                                  className="btn btn-sm btn-outline-secondary"
                                                                  onClick={() => setShowDotsMenu(!showDotsMenu)}
                                                                >
                                                          ⋮
                                              </button>button>
                                            {showDotsMenu && (
                                          <div className="dropdown-menu show position-absolute end-0 shadow">
                                                        <button className="dropdown-item" onClick={onEdit}>
                                                                        ✏️ Editar
                                                        </button>button>
                                                        <button className="dropdown-item text-danger" onClick={onDelete}>
                                                                        🗑️ Excluir
                                                        </button>button>
                                          </div>div>
                                              )}
                                    </div>div>
                            </div>div>
                      
                            <div className="card-body">
                                    {/* Stats */}
                                    <div className="row text-center mb-4">
                                              <div className="col-4">
                                                          <div className="h2 text-warning mb-1">{pendLabel(totalPending)}</div>div>
                                                          <div className="text-muted small">Pendentes</div>div>
                                              </div>div>
                                              <div className="col-4">
                                                          <div className="h2 text-success mb-1">{pendLabel(totalCompleted)}</div>div>
                                                          <div className="text-muted small">Concluídas</div>div>
                                              </div>div>
                                              <div className="col-4">
                                                          <div className="h2 text-info mb-1">{services.length}</div>div>
                                                          <div className="text-muted small">Serviços</div>div>
                                              </div>div>
                                    </div>div>
                            
                                    {/* Vínculos */}
                                    {vinculos.length > 0 && (
                                        <div className="mb-4">
                                                    <h6 className="text-muted mb-2">VÍNCULOS</h6>h6>
                                                    <div className="d-flex gap-2 flex-wrap">
                                                            {vinculos.map(vinculo => (
                                                                <div key={vinculo.id} className="badge bg-light text-dark border">
                                                                        {vinculo.linked_client?.name} • {papelVinculo(vinculo)}
                                                                </div>div>
                                                              ))}
                                                    </div>div>
                                        </div>div>
                                    )}
                            
                                    {/* Serviços e Tarefas */}
                                    <div className="mb-4">
                                              <div className="d-flex justify-content-between align-items-center mb-3">
                                                          <h6 className="text-muted mb-0">SERVIÇOS E TAREFAS</h6>h6>
                                                          <button 
                                                                                className="btn btn-sm btn-primary"
                                                                                onClick={() => setAddFormSvc('new')}
                                                                              >
                                                                        + Adicionar Serviço
                                                          </button>button>
                                              </div>div>
                                    
                                            {addFormSvc === 'new' && (
                                          <div className="card border mb-3">
                                                        <div className="card-body">
                                                                        <form id="addServiceForm">
                                                                                          <div className="row mb-3">
                                                                                                              <div className="col-md-6">
                                                                                                                                    <label className="form-label">Nome do Serviço</label>label>
                                                                                                                                    <input type="text" name="nome" className="form-control" required />
                                                                                                                      </div>div>
                                                                                                              <div className="col-md-6">
                                                                                                                                    <label className="form-label">Responsável</label>label>
                                                                                                                                    <select name="responsavel" className="form-control" required>
                                                                                                                                                            <option value="Ellen Maximiano">Ellen Maximiano</option>option>
                                                                                                                                                            <option value="Andrews Maximiano">Andrews Maximiano</option>option>
                                                                                                                                            </select>select>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                          <div className="row mb-3">
                                                                                                              <div className="col-md-12">
                                                                                                                                    <label className="form-label">Área</label>label>
                                                                                                                                    <select name="area" className="form-control" required>
                                                                                                                                            {AREAS_SERVICO.map(area => (
                                                                            <option key={area} value={area}>{area}</option>option>
                                                                          ))}
                                                                                                                                            </select>select>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                          <div className="mb-3">
                                                                                                              <label className="form-label">Status do Atendimento</label>label>
                                                                                                              <textarea name="status_atendimento" className="form-control" rows={3}></textarea>textarea>
                                                                                                  </div>div>
                                                                                          <div className="d-flex gap-2">
                                                                                                              <button type="button" className="btn btn-success" onClick={() => saveService(client.id)}>
                                                                                                                                    Salvar
                                                                                                                      </button>button>
                                                                                                              <button type="button" className="btn btn-outline-secondary" onClick={() => setAddFormSvc(null)}>
                                                                                                                                    Cancelar
                                                                                                                      </button>button>
                                                                                                  </div>div>
                                                                        </form>form>
                                                        </div>div>
                                          </div>div>
                                              )}
                                    
                                            {editFormSvc && (
                                          <div className="card border mb-3">
                                                        <div className="card-body">
                                                                        <form id="editServiceForm">
                                                                                          <div className="row mb-3">
                                                                                                              <div className="col-md-6">
                                                                                                                                    <label className="form-label">Nome do Serviço</label>label>
                                                                                                                                    <input type="text" name="nome" className="form-control" defaultValue={editFormSvc.nome} required />
                                                                                                                      </div>div>
                                                                                                              <div className="col-md-6">
                                                                                                                                    <label className="form-label">Responsável</label>label>
                                                                                                                                    <select name="responsavel" className="form-control" defaultValue={editFormSvc.responsavel} required>
                                                                                                                                                            <option value="Ellen Maximiano">Ellen Maximiano</option>option>
                                                                                                                                                            <option value="Andrews Maximiano">Andrews Maximiano</option>option>
                                                                                                                                            </select>select>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                          <div className="row mb-3">
                                                                                                              <div className="col-md-12">
                                                                                                                                    <label className="form-label">Área</label>label>
                                                                                                                                    <select name="area" className="form-control" defaultValue={editFormSvc.area} required>
                                                                                                                                            {AREAS_SERVICO.map(area => (
                                                                            <option key={area} value={area}>{area}</option>option>
                                                                          ))}
                                                                                                                                            </select>select>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                          <div className="mb-3">
                                                                                                              <label className="form-label">Status do Atendimento</label>label>
                                                                                                              <textarea name="status_atendimento" className="form-control" rows={3} defaultValue={editFormSvc.status_atendimento}></textarea>textarea>
                                                                                                  </div>div>
                                                                                          <div className="d-flex gap-2">
                                                                                                              <button type="button" className="btn btn-success" onClick={() => updateServiceData(editFormSvc)}>
                                                                                                                                    Salvar
                                                                                                                      </button>button>
                                                                                                              <button type="button" className="btn btn-outline-secondary" onClick={() => setEditFormSvc(null)}>
                                                                                                                                    Cancelar
                                                                                                                      </button>button>
                                                                                                  </div>div>
                                                                        </form>form>
                                                        </div>div>
                                          </div>div>
                                              )}
                                    
                                            {services.length === 0 ? (
                                          <div className="text-center py-4">
                                                        <div className="text-muted">Nenhum serviço cadastrado.</div>div>
                                                        <p className="text-muted">Cadastre um serviço para poder adicionar tarefas.</p>p>
                                          </div>div>
                                        ) : (
                                          services.map(service => (
                                                                <div key={service.id} className="border rounded p-3 mb-3">
                                                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                                                                  <div>
                                                                                                                      <h6 className="mb-1">{service.nome}</h6>h6>
                                                                                                                      <div className="text-muted small">
                                                                                                                                            <strong>Responsável:</strong>strong> {service.responsavel} • 
                                                                                                                                            <strong>Área:</strong>strong> {service.area}
                                                                                                                              </div>div>
                                                                                                          </div>div>
                                                                                                  <div className="d-flex gap-1">
                                                                                                                      <button 
                                                                                                                                                    className="btn btn-sm btn-outline-primary"
                                                                                                                                                    onClick={() => setEditFormSvc(service)}
                                                                                                                                                  >
                                                                                                                                            ✏️
                                                                                                                              </button>button>
                                                                                                                      <button 
                                                                                                                                                    className="btn btn-sm btn-outline-danger"
                                                                                                                                                    onClick={() => deleteServiceConfirm(service)}
                                                                                                                                                  >
                                                                                                                                            🗑️
                                                                                                                              </button>button>
                                                                                                                      <button 
                                                                                                                                                    className="btn btn-sm btn-outline-success"
                                                                                                                                                    onClick={() => setAddFormTask(service.id)}
                                                                                                                                                  >
                                                                                                                                            + Tarefa
                                                                                                                              </button>button>
                                                                                                          </div>div>
                                                                                </div>div>
                                                                
                                                                        {service.status_atendimento && (
                                                                                          <div className="bg-light p-2 rounded mb-2">
                                                                                                              <strong>Status do Atendimento:</strong>strong><br />
                                                                                                  {service.status_atendimento}
                                                                                                  </div>div>
                                                                                )}
                                                                
                                                                        {addFormTask === service.id && (
                                                                                          <div className="card border mt-2 mb-2">
                                                                                                              <div className="card-body">
                                                                                                                                    <form id={`addTaskForm-${service.id}`}>
                                                                                                                                                            <div className="row mb-3">
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Título da Tarefa</label>label>
                                                                                                                                                                                                                  <input type="text" name="title" className="form-control" required />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Responsável</label>label>
                                                                                                                                                                                                                  <select name="resp" className="form-control" required>
                                                                                                                                                                                                                                                <option value="Ellen Maximiano">Ellen Maximiano</option>option>
                                                                                                                                                                                                                                                <option value="Andrews Maximiano">Andrews Maximiano</option>option>
                                                                                                                                                                                                                                              </select>select>
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="row mb-3">
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Data</label>label>
                                                                                                                                                                                                                  <input type="date" name="date" className="form-control" />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Hora</label>label>
                                                                                                                                                                                                                  <input type="time" name="time" className="form-control" />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="mb-3">
                                                                                                                                                                                      <label className="form-label">Anotações</label>label>
                                                                                                                                                                                      <textarea name="anotacoes" className="form-control" rows={2}></textarea>textarea>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="d-flex gap-2">
                                                                                                                                                                                      <button type="button" className="btn btn-success" onClick={() => saveSubtask(service.id)}>
                                                                                                                                                                                                                  Salvar
                                                                                                                                                                                                                </button>button>
                                                                                                                                                                                      <button type="button" className="btn btn-outline-secondary" onClick={() => setAddFormTask(null)}>
                                                                                                                                                                                                                  Cancelar
                                                                                                                                                                                                                </button>button>
                                                                                                                                                                    </div>div>
                                                                                                                                            </form>form>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                )}
                                                                
                                                                        {editFormTask && (
                                                                                          <div className="card border mt-2 mb-2">
                                                                                                              <div className="card-body">
                                                                                                                                    <form id="editTaskForm">
                                                                                                                                                            <div className="row mb-3">
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Título da Tarefa</label>label>
                                                                                                                                                                                                                  <input type="text" name="title" className="form-control" defaultValue={editFormTask.title} required />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Responsável</label>label>
                                                                                                                                                                                                                  <select name="resp" className="form-control" defaultValue={editFormTask.resp} required>
                                                                                                                                                                                                                                                <option value="Ellen Maximiano">Ellen Maximiano</option>option>
                                                                                                                                                                                                                                                <option value="Andrews Maximiano">Andrews Maximiano</option>option>
                                                                                                                                                                                                                                              </select>select>
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="row mb-3">
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Data</label>label>
                                                                                                                                                                                                                  <input type="date" name="date" className="form-control" defaultValue={editFormTask.date} />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                                      <div className="col-md-6">
                                                                                                                                                                                                                  <label className="form-label">Hora</label>label>
                                                                                                                                                                                                                  <input type="time" name="time" className="form-control" defaultValue={editFormTask.time} />
                                                                                                                                                                                                                </div>div>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="mb-3">
                                                                                                                                                                                      <label className="form-label">Anotações</label>label>
                                                                                                                                                                                      <textarea name="anotacoes" className="form-control" rows={2} defaultValue={editFormTask.anotacoes}></textarea>textarea>
                                                                                                                                                                    </div>div>
                                                                                                                                                            <div className="d-flex gap-2">
                                                                                                                                                                                      <button type="button" className="btn btn-success" onClick={() => updateTaskData(editFormTask)}>
                                                                                                                                                                                                                  Salvar
                                                                                                                                                                                                                </button>button>
                                                                                                                                                                                      <button type="button" className="btn btn-outline-secondary" onClick={() => setEditFormTask(null)}>
                                                                                                                                                                                                                  Cancelar
                                                                                                                                                                                                                </button>button>
                                                                                                                                                                    </div>div>
                                                                                                                                            </form>form>
                                                                                                                      </div>div>
                                                                                                  </div>div>
                                                                                )}
                                                                
                                                                        {/* Tarefas do Serviço */}
                                                                        {(subtasks[service.id] || []).map(task => (
                                                                                          <div key={task.id} className="ms-3 border-start border-2 border-info ps-3 mt-2">
                                                                                                              <div className="d-flex justify-content-between align-items-start">
                                                                                                                                    <div className="flex-grow-1">
                                                                                                                                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                                                                                                                                                      <input 
                                                                                                                                                                                                                          type="checkbox" 
                                                                                                                                                                                        checked={task.done}
                                                                                                                                                                                                                          onChange={() => toggleSub(task)}
                                                                                                                                                                                                                          className="form-check-input"
                                                                                                                                                                                                                        />
                                                                                                                                                                                      <span className={task.done ? 'text-decoration-line-through text-muted' : ''}>
                                                                                                                                                                                                                  {task.title}
                                                                                                                                                                                                                </span>span>
                                                                                                                                                                                      <span className="badge bg-secondary text-white small">
                                                                                                                                                                                                                  {task.resp}
                                                                                                                                                                                                                </span>span>
                                                                                                                                                                    </div>div>
                                                                                                                                            {(task.date || task.time) && (
                                                                                                                            <div className="text-muted small">
                                                                                                                                                        📅 {task.date} {task.time}
                                                                                                                                    </div>div>
                                                                                                                                                            )}
                                                                                                                                            {task.anotacoes && (
                                                                                                                            <div className="bg-light p-2 rounded mt-1 small">
                                                                                                                                                        <strong>Anotações:</strong>strong> {task.anotacoes}
                                                                                                                                    </div>div>
                                                                                                                                                            )}
                                                                                                                                            </div>div>
                                                                                                                                    <div className="d-flex gap-1">
                                                                                                                                                            <button 
                                                                                                                                                                                              className="btn btn-sm btn-outline-primary"
                                                                                                                                                                                              onClick={() => setEditFormTask(task)}
                                                                                                                                                                                            >
                                                                                                                                                                                      ✏️
                                                                                                                                                                    </button>button>
                                                                                                                                                            <button 
                                                                                                                                                                                              className="btn btn-sm btn-outline-danger"
                                                                                                                                                                                              onClick={() => deleteTaskConfirm(task)}
                                                                                                                                                                                            >
                                                                                                                                                                                      🗑️
                                                                                                                                                                    </button>button>
                                                                                                                                                            <button 
                                                                                                                                                                                              className="btn btn-sm btn-outline-info"
                                                                                                                                                                                              onClick={() => setAddFormChecklist(task.id)}
                                                                                                                                                                                            >
                                                                                                                                                                                      + Sub
                                                                                                                                                                    </button>button>
                                                                                                                                                            <button 
                                                                                                                                                                                              className="btn btn-sm btn-outline-warning"
                                                                                                                                                                                              onClick={() => setOpenTask(prev => 
                                                                                                                                                                                                                                  prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                                                                                                                                                                                                                )}
                                                                                                                                                                                            >
                                                                                                                                                                                      💬
                                                                                                                                                                    </button>button>
                                                                                                                                            </div>div>
                                                                                                                      </div>div>
                                                                                          
                                                                                                  {addFormChecklist === task.id && (
                                                                                                                        <div className="card border mt-2 mb-2">
                                                                                                                                                <div className="card-body">
                                                                                                                                                                          <form id="addChecklistForm">
                                                                                                                                                                                                      <div className="mb-3">
                                                                                                                                                                                                                                    <label className="form-label">Descrição da Subtarefa</label>label>
                                                                                                                                                                                                                                    <input type="text" name="descricao" className="form-control" required />
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                      <div className="mb-3">
                                                                                                                                                                                                                                    <label className="form-label">Anotações</label>label>
                                                                                                                                                                                                                                    <textarea name="anotacoes" className="form-control" rows={2}></textarea>textarea>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                      <div className="d-flex gap-2">
                                                                                                                                                                                                                                    <button type="button" className="btn btn-success" onClick={() => saveChecklistItem(task.id)}>
                                                                                                                                                                                                                                                                    Salvar
                                                                                                                                                                                                                                                                  </button>button>
                                                                                                                                                                                                                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setAddFormChecklist(null)}>
                                                                                                                                                                                                                                                                    Cancelar
                                                                                                                                                                                                                                                                  </button>button>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                  </form>form>
                                                                                                                                                        </div>div>
                                                                                                                                </div>div>
                                                                                                              )}
                                                                                          
                                                                                                  {editFormChecklist && (
                                                                                                                        <div className="card border mt-2 mb-2">
                                                                                                                                                <div className="card-body">
                                                                                                                                                                          <form id="editChecklistForm">
                                                                                                                                                                                                      <div className="mb-3">
                                                                                                                                                                                                                                    <label className="form-label">Descrição da Subtarefa</label>label>
                                                                                                                                                                                                                                    <input type="text" name="descricao" className="form-control" defaultValue={editFormChecklist.descricao} required />
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                      <div className="mb-3">
                                                                                                                                                                                                                                    <label className="form-label">Anotações</label>label>
                                                                                                                                                                                                                                    <textarea name="anotacoes" className="form-control" rows={2} defaultValue={editFormChecklist.anotacoes}></textarea>textarea>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                      <div className="d-flex gap-2">
                                                                                                                                                                                                                                    <button type="button" className="btn btn-success" onClick={() => updateChecklistItemData(editFormChecklist)}>
                                                                                                                                                                                                                                                                    Salvar
                                                                                                                                                                                                                                                                  </button>button>
                                                                                                                                                                                                                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setEditFormChecklist(null)}>
                                                                                                                                                                                                                                                                    Cancelar
                                                                                                                                                                                                                                                                  </button>button>
                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                  </form>form>
                                                                                                                                                        </div>div>
                                                                                                                                </div>div>
                                                                                                              )}
                                                                                          
                                                                                                  {/* Subtarefas (Checklist) */}
                                                                                                  {(checklistItems[task.id] || []).map(item => (
                                                                                                                        <div key={item.id} className="ms-3 mt-1 d-flex justify-content-between align-items-start">
                                                                                                                                                <div className="d-flex align-items-start gap-2">
                                                                                                                                                                          <input 
                                                                                                                                                                                                              type="checkbox" 
                                                                                                                                                                            checked={item.done}
                                                                                                                                                                                                              onChange={() => toggleChecklistItem(item)}
                                                                                                                                                                                                              className="form-check-input mt-1"
                                                                                                                                                                                                            />
                                                                                                                                                                          <div>
                                                                                                                                                                                                      <span className={item.done ? 'text-decoration-line-through text-muted' : ''}>
                                                                                                                                                                                                                                    {item.descricao}
                                                                                                                                                                                                                                  </span>span>
                                                                                                                                                                                  {item.anotacoes && (
                                                                                                                                                              <div className="text-muted small mt-1">
                                                                                                                                                                                              📝 {item.anotacoes}
                                                                                                                                                                      </div>div>
                                                                                                                                                                                                      )}
                                                                                                                                                                                  </div>div>
                                                                                                                                                        </div>div>
                                                                                                                                                <div className="d-flex gap-1">
                                                                                                                                                                          <button 
                                                                                                                                                                                                              className="btn btn-sm btn-outline-primary"
                                                                                                                                                                                                              onClick={() => setEditFormChecklist(item)}
                                                                                                                                                                                                            >
                                                                                                                                                                                                      ✏️
                                                                                                                                                                                  </button>button>
                                                                                                                                                                          <button 
                                                                                                                                                                                                              className="btn btn-sm btn-outline-danger"
                                                                                                                                                                                                              onClick={() => deleteChecklistConfirm(item)}
                                                                                                                                                                                                            >
                                                                                                                                                                                                      🗑️
                                                                                                                                                                                  </button>button>
                                                                                                                                                        </div>div>
                                                                                                                                </div>div>
                                                                                                                      ))}
                                                                                          
                                                                                                  {/* Comments */}
                                                                                                  {openTask.includes(task.id) && (
                                                                                                                        <div className="mt-2">
                                                                                                                                                <div className="mb-2">
                                                                                                                                                                          <div className="input-group input-group-sm">
                                                                                                                                                                                                      <input 
                                                                                                                                                                                                                                            type="text" 
                                                                                                                                                                                                        className="form-control"
                                                                                                                                                                                                                                            placeholder="Adicionar comentário..."
                                                                                                                                                                                                                                            value={newComment[task.id] || ''}
                                                                                                                                                                                                                                            onChange={(e) => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                                                                                                                                                                                                            onKeyPress={(e) => e.key === 'Enter' && sendComment(task.id)}
                                                                                                                                                                                                                                          />
                                                                                                                                                                                                      <button 
                                                                                                                                                                                                                                            className="btn btn-primary"
                                                                                                                                                                                                                                            onClick={() => sendComment(task.id)}
                                                                                                                                                                                                                                            disabled={!newComment[task.id]?.trim()}
                                                                                                                                                                                                                                          >
                                                                                                                                                                                                                                    Enviar
                                                                                                                                                                                                                                  </button>button>
                                                                                                                                                                                  </div>div>
                                                                                                                                                        </div>div>
                                                                                                                                {(comments[task.id] || []).map(comment => (
                                                                                                                                                          <div key={comment.id} className="d-flex gap-2 mb-2 small">
                                                                                                                                                                                      <div className="text-center" style={{ minWidth: '30px' }}>
                                                                                                                                                                                                                    <div>{comment.av}</div>div>
                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                      <div className="flex-grow-1">
                                                                                                                                                                                                                    <div className="d-flex justify-content-between">
                                                                                                                                                                                                                                                    <strong>{comment.author}</strong>strong>
                                                                                                                                                                                                                                                    <span className="text-muted">{fmtDate(comment.dt)}</span>span>
                                                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                                                                    <div>{comment.text}</div>div>
                                                                                                                                                                                                                  </div>div>
                                                                                                                                                                  </div>div>
                                                                                                                                                        ))}
                                                                                                                                </div>div>
                                                                                                              )}
                                                                                                  </div>div>
                                                                                        ))}
                                                                </div>div>
                                                              ))
                                        )}
                                    </div>div>
                            </div>div>
                      </div>div>
                    )
}</div>
