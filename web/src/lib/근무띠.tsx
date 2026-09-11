/**
 * 화면 맨 위의 **상태 띠.**
 *
 * ── 언제 보이나 ────────────────────────────────────────────
 *
 * **알려야 할 일이 있을 때만** 보입니다. 늘 떠 있으면 아무도 안 읽습니다.
 * 지금 알리는 것은 둘 —
 *
 *   ① 오늘 이 컴퓨터가 꺼진다 (종료 예약)
 *   ② 사무실 안에서 열려 있다 (다른 컴퓨터가 들어올 수 있음)
 *
 * ── ★ 두 줄로 만들지 않습니다 ★ ────────────────────────────
 *
 * 처음에는 띠를 하나 더 붙일까 했습니다. 그러면 화면 위가 두 줄이
 * 되고, 그것만으로 프로그램이 어수선해 보입니다.
 * (2026-09-05 무무 — 「띄우되 UI 미관을 해치지 않는 방법을 고민해 줘」)
 *
 * 그래서 **한 띠 안에서** 다룹니다. 얇게, 옅게, 글자만.
 * 둘 다 있을 때만 두 줄이 되고, 보통은 한 줄입니다.
 *
 * ── 왜 단추가 여기 있나 ────────────────────────────────────
 *
 * 일이 늦어져 더 있어야 하는 날, 설정 화면까지 들어가게 하면 안 됩니다.
 * 보는 자리에서 바로 물릴 수 있어야 합니다.
 */
import { useEffect, useState, useCallback } from 'react'
import { api } from './api'

function 시각(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function 근무띠() {
  const [h, setH] = useState<any>(null)
  const [lan, setLan] = useState<any>(null)

  const 보기 = useCallback(async () => {
    try { setH(await api.근무시간()) } catch { setH(null) }
    try { setLan(await api.사무실열림()) } catch { setLan(null) }
  }, [])

  useEffect(() => {
    보기()
    // 꺼질 때가 가까워지면 화면이 알아야 하므로 이따금 다시 봅니다.
    const t = setInterval(보기, 60_000)
    return () => clearInterval(t)
  }, [보기])

  const 꺼짐 = h?.예약된때
  const 열림 = lan?.열림
  if (!꺼짐 && !열림) return null

  const 남은분 = 꺼짐
    ? Math.round((new Date(h.예약된때).getTime() - Date.now()) / 60_000) : 0
  const 곧 = !!꺼짐 && 남은분 <= 30

  return (
    <div className="상태띠">
      {꺼짐 && (
        <div className={'띠줄' + (곧 ? ' 곧꺼짐' : '')}>
          <span>
            <b>오늘 {시각(h.예약된때)} 에 이 컴퓨터가 꺼집니다.</b>{' '}
            {곧
              ? '하시던 일이 있으면 지금 저장해 주세요.'
              : '저장 안 한 것이 있으면 그 전에 저장해 주세요.'}
          </span>
          <button className="plain 띠단추" onClick={async () => {
            await api.종료예약취소().catch(() => {}); 보기()
          }}>예약 취소</button>
        </div>
      )}

      {열림 && (
        <div className="띠줄 열림">
          <span>
            <b>사무실 안에서 열려 있습니다.</b>{' '}
            {lan.닫힐때 && `${시각(lan.닫힐때)} 에 닫힙니다.`}{' '}
            <span className="muted">번호 {lan.번호}</span>
          </span>
          <button className="plain 띠단추" onClick={async () => {
            await api.사무실닫기().catch(() => {}); 보기()
          }}>지금 닫기</button>
        </div>
      )}
    </div>
  )
}
