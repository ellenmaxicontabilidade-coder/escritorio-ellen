// app/api/triagem/route.ts
// Endpoint para triagem MANUAL - permite colar conversa e gerar tarefas

import { NextRequest, NextResponse } from 'next/server'
import { interpretarConversa, montarTextoTarefa } from '@/lib/triagem'
import { processarTriagem } from '@/lib/processarTriagem'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.ticketId) {
      const resultado = await processarTriagem(body.ticketId)
      return NextResponse.json(resultado)
    }

    if (body.conversa) {
      const dados = await interpretarConversa(body.conversa)

      const tarefasFormatadas = dados.tarefas.map((tarefa, i) =>
        montarTextoTarefa(dados, tarefa, `MANUAL-${Date.now()}-${i}`)
      )

      return NextResponse.json({
        sucesso: true,
        dados,
        tarefasFormatadas,
        resumo: {
          cliente: dados.titular_nome || dados.nome_solicitante,
          totalTarefas: dados.tarefas.length,
          totalDocumentos: dados.documentos.length,
          totalVinculos: dados.vinculos.length,
          clienteNovo: dados.cliente_novo,
        }
      })
    }

    return NextResponse.json(
      { erro: 'Envie ticketId ou conversa no body' },
      { status: 400 }
    )

  } catch (erro) {
    console.error('[Triagem API] Erro:', erro)
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
