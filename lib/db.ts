import { supabase } from './supabase'
import type { Client, Service, Subtask, Comment, Task, Vinculo, TipoVinculo } from './types'

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
export async function createVinculoBidirecional(
    clientAId: string,
    clientBId: string,
    rels: string[],
    tipoA: TipoVinculo,
    outroVal?: string
  ): Promise<void> {
    const tipoB: TipoVinculo = tipoA === 'rep' ? 'repd' : 'rep'
    const { error } = await supabase.from('vinculos').insert([
      { client_id: clientAId, linked_id: clientBId, rels, tipo: tipoA, outro_val: outroVal },
      { client_id: clientBId, linked_id: clientAId, rels, tipo: tipoB, outro_val: outroVal }
        ])
    if (error) throw error
}

export async function updateVinculoBidirecional(
    clientAId: string,
    clientBId: string,
    rels: string[],
    outroVal?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('vinculos')
      .update({ rels, outro_val: outroVal })
      .or(`and(client_id.eq.${clientAId},linked_id.eq.${clientBId}),and(client_id.eq.${clientBId},linked_id.eq.${clientAId})`)
    if (error) throw error
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
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
