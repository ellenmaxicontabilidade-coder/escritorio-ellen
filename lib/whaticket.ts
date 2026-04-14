// lib/whaticket.ts
// Funções para comunicar com a API do Whaticket

const BASE_URL = process.env.WHATICKET_API_URL || 'https://app.whaticket.com'
const TOKEN = process.env.WHATICKET_TOKEN || ''

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
  }
}

export interface WhaticketMessage {
  id: string
  body: string
  fromMe: boolean
  mediaUrl?: string
  mediaType?: string
  createdAt: string
  contact?: { name: string; number: string }
}

export interface WhaticketTicket {
  id: string
  status: string
  lastMessage: string
  contact: { id: string; name: string; number: string; email?: string }
  queue?: { id: string; name: string }
  user?: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export async function getTicket(ticketId: string): Promise<WhaticketTicket> {
  const res = await fetch(`${BASE_URL}/api/tickets/${ticketId}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Erro ao buscar ticket ${ticketId}: ${res.status}`)
  return res.json()
}

export async function getMessages(ticketId: string): Promise<WhaticketMessage[]> {
  const res = await fetch(`${BASE_URL}/api/messages/${ticketId}?pageNumber=1`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Erro ao buscar mensagens do ticket ${ticketId}: ${res.status}`)
  const data = await res.json()
  return data?.messages?.rows || data?.rows || []
}

export function formatConversation(
  ticket: WhaticketTicket,
  messages: WhaticketMessage[]
): string {
  const lines: string[] = []
  lines.push(`=== CONVERSA DO WHATICKET ===`)
  lines.push(`Contato: ${ticket.contact.name} (${ticket.contact.number})`)
  lines.push(`Status: ${ticket.status}`)
  lines.push(`Fila: ${ticket.queue?.name || 'Sem fila'}`)
  lines.push(`Atendente: ${ticket.user?.name || 'Não atribuído'}`)
  lines.push(`Data: ${new Date(ticket.createdAt).toLocaleString('pt-BR')}`)
  lines.push(``)
  lines.push(`=== MENSAGENS ===`)
  messages.forEach(msg => {
    const quem = msg.fromMe ? 'ATENDENTE' : 'CLIENTE'
    const hora = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit'
    })
    if (msg.mediaType && msg.mediaType !== 'chat') {
      lines.push(`[${hora}] ${quem}: [${msg.mediaType.toUpperCase()}: ${msg.mediaUrl || 'arquivo'}]`)
    } else if (msg.body) {
      lines.push(`[${hora}] ${quem}: ${msg.body}`)
    }
  })
  return lines.join('\n')
}
