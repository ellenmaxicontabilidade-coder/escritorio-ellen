import { supabase } from './supabase'
import type { Client, Service, Subtask, Comment, Task, Vinculo, TipoVinculo, ChecklistItem } from './types'

// CLIENTS
export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function createClient(client: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// VINCULOS
export async function getVinculos(clientId: string): Promise<Vinculo[]> {
  const { data, error } = await supabase
    .from('vinculos')
    .select('*, linked_client:linked_id(id, name, av_bg, av_cl, meta, badges)')
    .eq('client_id', clientId)
  if (error) throw error
  return data || []
}

export async function createVinculo(v: Omit<Vinculo, 'id'>): Promise<Vinculo> {
  const { data, error } = await supabase
    .from('vinculos')
    .insert(v)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVinculo(id: string): Promise<void> {
  const { error } = await supabase.from('vinculos').delete().eq('id', id)
  if (error) throw error
}

export async function deleteVinculosByClient(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('vinculos')
    .delete()
    .or(`client_id.eq.${clientId},linked_id.eq.${clientId}`)
  if (error) throw error
}

// SERVICES
export async function getServicesByClient(clientId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createService(svc: Omit<Service, 'id'>): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert(svc)
    .select()
    .single()
  if (error) throw error
  return data
}

// SUBTASKS
export async function getSubtasksByService(serviceId: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function getSubtasksByDate(date: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*, service:service_id(id, nome, tipo, orig, client_id, clients(id, name, av_bg, av_cl))')
    .eq('date', date)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createSubtask(sub: Omit<Subtask, 'id'>): Promise<Subtask> {
  const { data, error } = await supabase
    .from('subtasks')
    .insert(sub)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSubtask(id: string, updates: Partial<Subtask>): Promise<Subtask> {
  const { data, error } = await supabase
    .from('subtasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase.from('subtasks').delete().eq('id', id)
  if (error) throw error
}

// COMMENTS
export async function getCommentsBySubtask(subtaskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('subtask_id', subtaskId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createComment(comment: Omit<Comment, 'id'>): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert(comment)
    .select()
    .single()
  if (error) throw error
  return data
}

// TASKS
export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// VINCULOS BIDIRECIONAIS
// Mapa de parentesco reciproco: quando A tem rel X com B, B tem rel reciproco(X) com A
const RECIPROCAL_REL_MAP: Record<string, string> = {
  // Filiacao
  'Filha': 'Mãe',
  'Filho': 'Pai',
  'Mãe': 'Filha',
  'Mae': 'Filha',
  'Pai': 'Filho',
  // Tios/Sobrinhos
  'Tia': 'Sobrinho(a)',
  'Tio': 'Sobrinho(a)',
  'Sobrinho': 'Tio/Tia',
  'Sobrinha': 'Tio/Tia',
  'Sobrinho(a)': 'Tio/Tia',
  // Avos/Netos
  'Avó': 'Neto(a)',
  'Avo': 'Neto(a)',
  'Avô': 'Neto(a)',
  'Neto': 'Avô/Avó',
  'Neta': 'Avô/Avó',
  'Neto(a)': 'Avô/Avó',
  // Irmaos (simetrico)
  'Irmão': 'Irmão(ã)',
  'Irmao': 'Irmão(ã)',
  'Irmã': 'Irmão(ã)',
  'Irma': 'Irmão(ã)',
  // Primos (simetrico)
  'Primo': 'Primo(a)',
  'Prima': 'Primo(a)',
}

function reciprocalRel(rel: string): string {
  if (!rel) return rel
  const trimmed = rel.trim()
  if (RECIPROCAL_REL_MAP[trimmed]) return RECIPROCAL_REL_MAP[trimmed]
  const lower = trimmed.toLowerCase()
  for (const key of Object.keys(RECIPROCAL_REL_MAP)) {
    if (key.toLowerCase() === lower) return RECIPROCAL_REL_MAP[key]
  }
  // Relacoes simetricas (Conjuge, Socio, Dependente, etc) permanecem iguais
  return trimmed
}

function reciprocalRels(rels: string[]): string[] {
  return (rels || []).map(reciprocalRel)
}

// Sincroniza os badges Representante/Representado dos dois clientes de um vinculo.
// Regra: quando um cliente e "Representante", o outro vinculado deve ser "Representado" (e vice-versa).
// Mantem os demais badges (PF, PJ, etc). Remove badges conflitantes.
async function syncRepresentacaoBadges(clientAId: string, clientBId: string, tipoA: TipoVinculo): Promise<void> {
  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('id, badges')
    .in('id', [clientAId, clientBId])
  if (error) throw error
  if (!clientsData || clientsData.length === 0) return

  const badgeA = tipoA === 'rep' ? 'Representante' : 'Representado'
  const badgeB = tipoA === 'rep' ? 'Representado' : 'Representante'

  for (const c of clientsData) {
    const targetBadge = c.id === clientAId ? badgeA : badgeB
    const oppositeBadge = targetBadge === 'Representante' ? 'Representado' : 'Representante'
    const current: string[] = Array.isArray(c.badges) ? c.badges : []
    const next = current.filter((b: string) => b !== oppositeBadge)
    if (!next.includes(targetBadge)) next.push(targetBadge)
    const changed = next.length !== current.length || next.some((b: string) => !current.includes(b))
    if (changed) {
      const { error: upErr } = await supabase
        .from('clients')
        .update({ badges: next })
        .eq('id', c.id)
      if (upErr) throw upErr
    }
  }
}

export async function createVinculoBidirecional(
  clientAId: string,
  clientBId: string,
  rels: string[],
  tipoA: TipoVinculo,
  outroVal?: string
): Promise<void> {
  const tipoB: TipoVinculo = tipoA === 'rep' ? 'repd' : 'rep'
  const relsB = reciprocalRels(rels)
  const outroValB = outroVal ? reciprocalRel(outroVal) : outroVal
  const { error } = await supabase.from('vinculos').insert([
    { client_id: clientAId, linked_id: clientBId, rels, tipo: tipoA, outro_val: outroVal },
    { client_id: clientBId, linked_id: clientAId, rels: relsB, tipo: tipoB, outro_val: outroValB }
  ])
  if (error) throw error
  // Sincroniza badges: quando A e Representante, B vira Representado e vice-versa
  await syncRepresentacaoBadges(clientAId, clientBId, tipoA)
}

export async function updateVinculoBidirecional(
  clientAId: string,
  clientBId: string,
  rels: string[],
  outroVal?: string
): Promise<void> {
  const relsB = reciprocalRels(rels)
  const outroValB = outroVal ? reciprocalRel(outroVal) : outroVal
  const { error: errA } = await supabase
    .from('vinculos')
    .update({ rels, outro_val: outroVal })
    .eq('client_id', clientAId)
    .eq('linked_id', clientBId)
  if (errA) throw errA
  const { error: errB } = await supabase
    .from('vinculos')
    .update({ rels: relsB, outro_val: outroValB })
    .eq('client_id', clientBId)
    .eq('linked_id', clientAId)
  if (errB) throw errB
  // Reavalia badges com base no tipo atual do vinculo
  const { data: vA } = await supabase
    .from('vinculos')
    .select('tipo')
    .eq('client_id', clientAId)
    .eq('linked_id', clientBId)
    .maybeSingle()
  if (vA?.tipo) {
    await syncRepresentacaoBadges(clientAId, clientBId, vA.tipo as TipoVinculo)
  }
}

export async function deleteVinculoBidirecional(clientAId: string, clientBId: string): Promise<void> {
  const { error } = await supabase
    .from('vinculos')
    .delete()
    .or(`and(client_id.eq.${clientAId},linked_id.eq.${clientBId}),and(client_id.eq.${clientBId},linked_id.eq.${clientAId})`)
  if (error) throw error
}

export async function deleteClientCompleto(clientId: string): Promise<void> {
  await supabase.from('vinculos').delete().or(`client_id.eq.${clientId},linked_id.eq.${clientId}`)
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}

// SYNC DE SUBTAREFAS
export async function propagateSync(subtaskId: string, done: boolean): Promise<void> {
  const { data: sub } = await supabase
    .from('subtasks')
    .select('sync_group')
    .eq('id', subtaskId)
    .single()
  if (!sub?.sync_group) return
  await supabase
    .from('subtasks')
    .update({ done })
    .eq('sync_group', sub.sync_group)
    .neq('id', subtaskId)
}

export async function toggleSubtaskWithSync(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('subtasks').update({ done }).eq('id', id)
  if (error) throw error
  await propagateSync(id, done)
}

export function makeSyncGroup(prefix: string = 'sg'): string {
  // ==== SERVICES extras ====
  export async function updateService(id: string, updates: Partial<Service>): Promise<Service> {
      const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
  }

  export async function deleteService(id: string): Promise<void> {
      // Em cascata: apagar subtasks (e checklist_items via ON DELETE CASCADE) e comments
      const { data: subs } = await supabase.from('subtasks').select('id').eq('service_id', id)
      if (subs && subs.length) {
            const ids = subs.map(s => s.id)
            await supabase.from('comments').delete().in('subtask_id', ids)
            await supabase.from('checklist_items').delete().in('subtask_id', ids)
            await supabase.from('subtasks').delete().eq('service_id', id)
      }
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
  }

  // ==== CHECKLIST ITEMS (Subtarefas) ====
  export async function getChecklistItemsBySubtask(subtaskId: string): Promise<ChecklistItem[]> {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('subtask_id', subtaskId)
        .order('created_at')
      if (error) throw error
      return data || []
  }

  export async function createChecklistItem(item: Omit<ChecklistItem, 'id' | 'created_at'>): Promise<ChecklistItem> {
      const { data, error } = await supabase
        .from('checklist_items')
        .insert(item)
        .select()
        .single()
      if (error) throw error
      return data
  }

  export async function updateChecklistItem(id: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem> {
      const { data, error } = await supabase
        .from('checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
  }

  export async function deleteChecklistItem(id: string): Promise<void> {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id)
      if (error) throw error
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
