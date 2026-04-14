export type Badge = 'PF' | 'PJ' | 'Representante'
export type TipoServico = 'prev' | 'contab' | 'assessoria' | 'cliente' | 'interno'
export type TipoVinculo = 'rep' | 'repd'
export type Prioridade = 'alta' | 'media' | 'baixa'
export type Responsavel = 'Ellen Maximiano' | 'Andrews Maximiano'

export interface Client {
  id: string
  name: string
  meta: string
  cnpj?: string
  badges: Badge[]
  obs: string
  av_bg: string
  av_cl: string
  created_at?: string
}

export interface Vinculo {
  id: string
  client_id: string
  linked_id: string
  rels: string[]
  tipo: TipoVinculo
  outro_val?: string
  linked_client?: Client
}

export interface Service {
  id: string
  client_id: string
  nome: string
  tipo: TipoServico
  orig?: string
  sync_group?: string
  subtasks?: Subtask[]
}

export interface Subtask {
  id: string
  service_id: string
  title: string
  done: boolean
  resp: Responsavel
  date?: string
  time?: string
  sync_group?: string
  comments?: Comment[]
}

export interface Comment {
  id: string
  subtask_id: string
  author: string
  av: string
  init: string
  text: string
  dt: string
}

export interface Task {
  id: string
  title: string
  client_name: string
  client_id?: string
  service: string
  resp: Responsavel
  tipo: TipoServico
  priority: Prioridade
  done: boolean
  sync_group?: string
  sync_orig?: string
  date: string
}
