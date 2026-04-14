export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowStr(): string {
  const d = new Date()
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ini(name: string): string {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?'
}

export function fmtDate(date?: string, time?: string): string | null {
  if (!date) return null
  const p = date.split('-')
  return `${p[2]}/${p[1]}${time ? ' ' + time + 'h' : ''}`
}

export const MNS = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

export const DLONG = ['Dom','Segunda','Terca','Quarta','Quinta','Sexta','Sabado']

export const TIPO_LABEL: Record<string, string> = {
  contab: 'Contabilidade',
  assessoria: 'Cont. | Assessoria',
  prev: 'Previdenciario',
  cliente: 'Entrega Cliente',
  interno: 'Interno',
  assess: 'Cont. | Assessoria',
}

export const TIPO_CLS: Record<string, string> = {
  contab: 'chip-c',
  assessoria: 'chip-a',
  prev: 'chip-p',
  cliente: 'chip-g',
  interno: 'chip-i',
}

export function badgeCls(b: string): string {
  return b === 'PF' ? 'badge-pf' : b === 'PJ' ? 'badge-pj' : 'badge-rep'
}

export function chipResp(r: string): string {
  return r === 'Ellen Maximiano' ? 'chip-ellen' : 'chip-andrews'
}

export const COLORS = [
  { bg: '#EEEDFE', cl: '#3C3489' },
  { bg: '#FAEEDA', cl: '#633806' },
  { bg: '#EAF3DE', cl: '#27500A' },
  { bg: '#E6F1FB', cl: '#185FA5' },
  { bg: '#FBEAF0', cl: '#72243E' },
  { bg: '#F1EFE8', cl: '#444441' },
]

export function getColor(name: string) {
  if (!name) return COLORS[0]
  const idx = name.charCodeAt(0) % COLORS.length
  return COLORS[idx] || COLORS[0]
}
