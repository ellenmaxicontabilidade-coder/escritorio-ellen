// lib/processarTriagem.ts
// Orquestra o fluxo completo:
// 1. Busca conversa no Whaticket
// 2. Envia para IA interpretar
// 3. Cria/atualiza cliente no banco
// 4. Cria tarefas no banco
// 5. Registra log da triagem

import { getTicket, getMessages, formatConversation } from './whaticket'
import { interpretarConversa, montarTextoTarefa } from './triagem'
import { supabase } from './supabase'
import { getColor, toISO } from './utils'
import type { DadosExtraidos } from './triagem'

export interface ResultadoTriagem {
  sucesso: boolean
  ticketId: string
  clienteId?: string
  clienteNome?: string
  tarefasCriadas: number
  tarefas: string[]
  erro?: string
}

export async function processarTriagem(ticketId: string): Promise<ResultadoTriagem> {
  try {
    console.log(`[Triagem] Buscando ticket ${ticketId}...`)
    const ticket = await getTicket(ticketId)
    const messages = await getMessages(ticketId)

    if (messages.length === 0) {
      await registrarLog({ ticketId, status: 'erro', erro: 'Nenhuma mensagem no ticket' })
      return { sucesso: false, ticketId, tarefasCriadas: 0, tarefas: [], erro: 'Nenhuma mensagem encontrada no ticket' }
    }

    console.log(`[Triagem] Interpretando ${messages.length} mensagens...`)
    const conversa = formatConversation(ticket, messages)
    const dados = await interpretarConversa(conversa)
    console.log(`[Triagem] IA extraiu ${dados.tarefas.length} tarefa(s)`)

    const clienteId = await buscarOuCriarCliente(dados)

    const tarefasCriadas: string[] = []
    const hoje = toISO(new Date())

    for (const tarefa of dados.tarefas) {
      const textoTarefa = montarTextoTarefa(dados, tarefa, ticketId)

      const { data: novaTarefa, error: errTask } = await supabase
        .from('tasks')
        .insert({
          title: tarefa.descricao,
          client_name: dados.titular_nome || dados.nome_solicitante,
          client_id: clienteId || null,
          service: detectarServico(tarefa.descricao),
          resp: 'Andrews Maximiano',
          tipo: tarefa.area,
          priority: tarefa.prioridade,
          done: false,
          date: tarefa.prazo || hoje,
          sync_orig: ticket.contact.name,
        })
        .select()
        .single()

      if (errTask) {
        console.error('[Triagem] Erro ao criar tarefa:', errTask.message)
        continue
      }
      if (novaTarefa) tarefasCriadas.push(textoTarefa)
    }

    if (dados.documentos.length > 0) {
      console.log(`[Triagem] ${dados.documentos.length} documento(s) identificado(s):`)
      dados.documentos.forEach(doc => console.log(`  - ${doc.nome_sugerido}`))
    }

    await registrarLog({
      ticketId,
      contatoNome: ticket.contact.name,
      contatoNumero: ticket.contact.number,
      clienteId: clienteId || null,
      clienteNome: dados.titular_nome || dados.nome_solicitante,
      clienteNovo: dados.cliente_novo,
      tarefasCriadas: tarefasCriadas.length,
      documentosIdentificados: dados.documentos.length,
      status: 'sucesso',
      payloadIa: dados,
    })

    return {
      sucesso: true,
      ticketId,
      clienteId: clienteId || undefined,
      clienteNome: dados.titular_nome || dados.nome_solicitante,
      tarefasCriadas: tarefasCriadas.length,
      tarefas: tarefasCriadas,
    }
  } catch (erro) {
    console.error(`[Triagem] Erro ao processar ticket ${ticketId}:`, erro)
    const msg = erro instanceof Error ? erro.message : 'Erro desconhecido'
    await registrarLog({ ticketId, status: 'erro', erro: msg })
    return { sucesso: false, ticketId, tarefasCriadas: 0, tarefas: [], erro: msg }
  }
}

async function buscarOuCriarCliente(dados: DadosExtraidos): Promise<string | null> {
  const nome = dados.titular_nome || dados.nome_solicitante
  if (!nome) return null

  if (dados.titular_cpf) {
    const { data: existente } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('obs', `%${dados.titular_cpf}%`)
      .limit(1)
      .maybeSingle()
    if (existente) {
      console.log(`[Triagem] Cliente existente (por CPF): ${existente.name}`)
      return existente.id
    }
  }

  const primeiroNome = nome.split(' ')[0].toLowerCase()
  const { data: porNome } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `%${primeiroNome}%`)
    .limit(1)
    .maybeSingle()

  if (porNome) {
    console.log(`[Triagem] Cliente encontrado por nome: ${porNome.name}`)
    return porNome.id
  }

  if (dados.cliente_novo || dados.titular_nome) {
    const color = getColor(nome)
    const badges: string[] = []
    if (dados.eh_empresa) badges.push('PJ')
    else badges.push('PF')

    let obs = ''
    if (dados.titular_cpf) obs += `CPF: ${dados.titular_cpf}\n`
    if (dados.titular_cnpj) obs += `CNPJ: ${dados.titular_cnpj}\n`
    if (dados.observacoes) obs += dados.observacoes

    const { data: novoCliente } = await supabase
      .from('clients')
      .insert({
        name: nome,
        meta: dados.eh_empresa ? 'CPF + CNPJ' : 'CPF',
        cpf: dados.titular_cpf || null,
        cnpj: dados.titular_cnpj || null,
        badges,
        obs: obs.trim(),
        av_bg: color.bg,
        av_cl: color.cl,
      })
      .select()
      .single()

    if (novoCliente) {
      console.log(`[Triagem] Novo cliente criado: ${novoCliente.name}`)

      for (const vinculo of dados.vinculos) {
        if (!vinculo.nome) continue
        const vinculadoId = await buscarOuCriarClienteSimples(vinculo.nome)
        if (vinculadoId) {
          await supabase.from('vinculos').insert([
            { client_id: novoCliente.id, linked_id: vinculadoId, rels: [vinculo.relacao], tipo: 'rep' },
            { client_id: vinculadoId, linked_id: novoCliente.id, rels: [vinculo.relacao], tipo: 'repd' },
          ])
        }
      }

      return novoCliente.id
    }
  }

  return null
}

async function buscarOuCriarClienteSimples(nome: string): Promise<string | null> {
  const primeiroNome = nome.split(' ')[0].toLowerCase()
  const { data: existente } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', `%${primeiroNome}%`)
    .limit(1)
    .maybeSingle()
  if (existente) return existente.id

  const color = getColor(nome)
  const { data: novo } = await supabase
    .from('clients')
    .insert({
      name: nome,
      meta: 'CPF',
      badges: ['PF'],
      obs: '',
      av_bg: color.bg,
      av_cl: color.cl,
    })
    .select()
    .single()

  return novo?.id || null
}

function detectarServico(descricao: string): string {
  const d = descricao.toLowerCase()
  if (d.includes('bpc') || d.includes('loas')) return 'BPC/LOAS'
  if (d.includes('aposentadoria')) return 'Aposentadoria'
  if (d.includes('irpf') || d.includes('imposto de renda')) return 'IRPF'
  if (d.includes('simples') || d.includes('das') || d.includes('mei')) return 'Simples Nacional'
  if (d.includes('inss') || d.includes('previdenciário')) return 'INSS'
  if (d.includes('contrato') || d.includes('social')) return 'Contrato Social'
  if (d.includes('procuração')) return 'Procuração'
  if (d.includes('cnpj') || d.includes('abertura')) return 'Abertura de Empresa'
  return 'Atendimento Geral'
}

interface LogPayload {
  ticketId: string
  contatoNome?: string
  contatoNumero?: string
  clienteId?: string | null
  clienteNome?: string
  clienteNovo?: boolean
  tarefasCriadas?: number
  documentosIdentificados?: number
  status: 'sucesso' | 'erro'
  erro?: string
  payloadIa?: any
}

async function registrarLog(p: LogPayload): Promise<void> {
  try {
    await supabase.from('triagem_logs').insert({
      ticket_id: p.ticketId,
      contato_nome: p.contatoNome || null,
      contato_numero: p.contatoNumero || null,
      cliente_id: p.clienteId || null,
      cliente_nome: p.clienteNome || null,
      cliente_novo: p.clienteNovo || false,
      tarefas_criadas: p.tarefasCriadas || 0,
      documentos_identificados: p.documentosIdentificados || 0,
      status: p.status,
      erro: p.erro || null,
      payload_ia: p.payloadIa || null,
    })
  } catch (e) {
    console.warn('[Triagem] Falha ao registrar log:', e)
  }
}
