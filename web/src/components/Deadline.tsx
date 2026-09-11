import type { Recipient } from '../lib/api'

/**
 * 「중단」이 되면 90일 뒤가 종결 검토 기한입니다.
 * 지침상 3개월 이상 중단이면 종결 처리 대상이 되므로,
 * 기관이 놓치지 않도록 남은 날짜를 항상 같이 보여 줍니다.
 */
export default function Deadline({ r }: { r: Recipient }) {
  if (r.status !== '중단' || !r.suspendDeadline) return <span className="muted">—</span>

  const left = r.suspendDaysLeft
  const over = left !== null && left < 0

  return (
    <span className={`deadline${over ? ' over' : ''}`}>
      {r.suspendDeadline}
      {left !== null && (over ? ` (${-left}일 지남)` : ` (${left}일 남음)`)}
    </span>
  )
}
