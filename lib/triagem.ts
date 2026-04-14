// lib/triagem.ts
// Usa o Claude (Haiku 4.5) para interpretar conversas do Whaticket
// e extrair dados estruturados para criar tarefas

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface DadosExtraidos {
  nome_solicitante: string
  titular_nome: string
  titular_cpf?: string
  titular_cnpj?: string
  eh_empresa: boolean
  vinculos: Array<{ nome: string; cpf?: string; relacao: string }>
  tarefas: Array<{
    descricao: string
    area: 'prev' | 'contab' | 'assessoria' | 'cliente' | 'interno'
    prazo?: string
    prioridade: 'alta' | 'media' | 'baixa'
    dados_sensiveis?: string
    prometido_ao_cliente?: string
  }>
  documentos: Array<{
    tipo: string
    nome_sugerido: string
    arquivo_original?: string
  }>
  observacoes?: string
  cliente_novo: boolean
}

const SYSTEM_PROMPT = `Você é um assistente especializado em triagem de atendimentos jurídicos e contábeis.

Seu trabalho é ler conversas do WhatsApp/Whaticket e extrair informações estruturadas para criar tarefas no sistema do escritório.

ÁREAS DE ATUAÇÃO:
- prev: Previdenciário (INSS, aposentadoria, BPC/LOAS, revisões)
- contab: Contabilidade (Simples Nacional, IRPF, MEI, folha, obrigações)
- assessoria: Assessoria contábil e jurídica integrada
- cliente: Entrega de documento, retorno, envio de resultado
- interno: Tarefa interna do escritório (sem envolver cliente diretamente)

PRIORIDADES:
- alta: prazo urgente (hoje, amanhã, até sexta), cliente aguardando, risco de multa
- media: prazo em 1-2 semanas, demanda normal
- baixa: sem prazo definido, informativo

REGRAS:
1. Extraia TODOS os CPFs, CNPJs e senhas mencionados — são dados críticos
2. Se a conversa mencionar cônjuge, sócio, dependente ou representante, crie um vínculo
3. Se houver mais de uma demanda na mesma conversa, crie tarefas separadas
4. O campo "prometido_ao_cliente" deve registrar o que o atendente prometeu fazer ou entregar
5. Para documentos, sugira o nome padronizado no formato: [TIPO] - [NOME] - [ANO/MÊS se aplicável]
6. Se mencionar "cliente novo" ou não há histórico, marque cliente_novo como true
7. Datas em formato ISO (YYYY-MM-DD) quando possível. Se o cliente disser "sexta", converta para data concreta da próxima sexta.

Responda APENAS com JSON válido, sem texto antes ou depois, sem markdown.`

export async function interpretarConversa(conversa: string): Promise<DadosExtraidos> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analise esta conversa e retorne os dados estruturados em JSON:\n\n${conversa}`
      }
    ]
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Resposta inesperada da IA')

  const jsonText = content.text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    return JSON.parse(jsonText) as DadosExtraidos
  } catch {
    throw new Error(`Erro ao fazer parse do JSON da IA: ${jsonText.substring(0, 200)}`)
  }
}

export function montarTextoTarefa(
  dados: DadosExtraidos,
  tarefa: DadosExtraidos['tarefas'][0],
  ticketId: string
): string {
  const linhas: string[] = []
  linhas.push(`NOME: ${dados.nome_solicitante}`)

  let para = dados.titular_nome
  if (dados.titular_cpf) para += ` (CPF ${dados.titular_cpf})`
  if (dados.titular_cnpj) para += ` (CNPJ ${dados.titular_cnpj})`
  if (dados.vinculos.length > 0) {
    const vins = dados.vinculos
      .map(v => `${v.nome}${v.cpf ? ` CPF ${v.cpf}` : ''} — ${v.relacao}`)
      .join(', ')
    para += ` e ${vins}`
  }
  linhas.push(`PARA: ${para}`)

  let tarefaTexto = tarefa.descricao
  if (tarefa.dados_sensiveis) tarefaTexto += ` | Dados: ${tarefa.dados_sensiveis}`
  if (tarefa.prometido_ao_cliente) tarefaTexto += ` | Prometido: ${tarefa.prometido_ao_cliente}`
  linhas.push(`TAREFA: ${tarefaTexto}`)

  if (tarefa.prazo) linhas.push(`PRAZO: ${tarefa.prazo}`)
  linhas.push(`ORIGEM: Whaticket #${ticketId}`)

  return linhas.join('\n')
}
