// app/api/webhook/whaticket/route.ts
// Rota que recebe eventos do Whaticket via webhook

import { NextRequest, NextResponse } from 'next/server'
import { processarTriagem } from '@/lib/processarTriagem'

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-webhook-secret')
      || request.nextUrl.searchParams.get('secret')

    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      console.warn('[Webhook] Requisição sem secret válido rejeitada')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[Webhook] Evento recebido:', JSON.stringify(body).substring(0, 200))

    const evento = body.event || body.type || 'unknown'
    const ticketId = body.ticketId || body.ticket?.id || body.data?.ticketId

    console.log(`[Webhook] Evento: ${evento} | Ticket: ${ticketId}`)

    const eventosRelevantes = [
      'message.created',
      'MESSAGE_CREATED',
      'new_message',
      'ticket.created',
      'TICKET_CREATED',
    ]

    const deveProcessar = eventosRelevantes.some(e =>
      evento.toLowerCase().includes(e.toLowerCase())
    ) || evento === 'unknown'

    if (!deveProcessar) {
      console.log(`[Webhook] Evento ${evento} ignorado`)
      return NextResponse.json({ ok: true, ignorado: true })
    }

    if (!ticketId) {
      console.warn('[Webhook] ticketId nao encontrado no payload')
      return NextResponse.json({ ok: true, aviso: 'ticketId nao encontrado' })
    }

    processarEmBackground(ticketId)

    return NextResponse.json({
      ok: true,
      mensagem: `Triagem do ticket ${ticketId} iniciada`,
      ticketId
    })

  } catch (erro) {
    console.error('[Webhook] Erro:', erro)
    return NextResponse.json({
      ok: false,
      erro: erro instanceof Error ? erro.message : 'Erro interno'
    }, { status: 200 })
  }
}

async function processarEmBackground(ticketId: string) {
  try {
    console.log(`[Background] Iniciando triagem do ticket ${ticketId}...`)
    const resultado = await processarTriagem(ticketId)

    if (resultado.sucesso) {
      console.log(`[Background] OK Ticket ${ticketId} processado:`)
      console.log(`  Cliente: ${resultado.clienteNome}`)
      console.log(`  Tarefas criadas: ${resultado.tarefasCriadas}`)
      resultado.tarefas.forEach((t, i) => {
        console.log(`  Tarefa ${i + 1}:
${t}
`)
      })
    } else {
      console.error(`[Background] Erro no ticket ${ticketId}: ${resultado.erro}`)
    }
  } catch (erro) {
    console.error(`[Background] Erro fatal no ticket ${ticketId}:`, erro)
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mensagem: 'Webhook do Whaticket ativo',
    versao: '1.0.0'
  })
}
