/**
 * ── 이 PC 의 랜 주소 ──────────────────────────────────────────
 *
 * 현장앱은 **사무실 PC 가 서버**입니다 (2026-08-28 정함).
 * 그러면 제공인력 휴대폰이 같은 와이파이 안에서 이 PC 에 붙어야 하는데,
 * **그 주소를 사람이 찾아낼 방법이 없습니다.**
 *
 * 「제어판에서 IP 를 확인하세요」는 안내가 아닙니다.
 * **프로그램이 알아내서 검은 창과 설정 화면에 찍어 줍니다.**
 *
 * ── 왜 기본이 꺼짐인가 ────────────────────────────────────────
 * 지금까지 `127.0.0.1` 에만 귀를 연 이유가 둘입니다 —
 *   1) 바깥에서 이 PC 로 못 들어옵니다
 *   2) **윈도우 방화벽 경고창이 안 뜹니다**
 *
 * 랜을 열면 2)가 깨져 처음 한 번 파란 창이 뜹니다.
 * 「고객 입장에서는 굉장히 무서울 일」이라 **켜는 사람이 알고 켜야** 합니다.
 * 그래서 설정에서 켜고, 켜는 자리에 그 창이 뜬다는 것을 미리 적어 둡니다.
 */
import { networkInterfaces } from "node:os";

export type 랜후보 = { 이름: string; 주소: string; 사설인가: boolean };

/** 사설망 주소인가 — 192.168.x · 10.x · 172.16~31.x */
function 사설(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 192 && b === 168 ? true
       : a === 10 ? true
       : a === 172 && b >= 16 && b <= 31 ? true
       : false;
}

/**
 * 이 PC 가 가진 랜 주소들. 쓸 만한 것이 맨 앞에 옵니다.
 *
 * 컴퓨터 하나에 주소가 여럿인 것이 보통입니다 — 유선·무선·가상 랜카드
 * (VirtualBox·WSL·VPN 이 저마다 하나씩 만듭니다). 그중 **휴대폰이 붙을 수 있는
 * 것은 공유기가 나눠 준 사설망 주소**입니다. 그것부터 보여 줍니다.
 */
export function 랜주소들(): 랜후보[] {
  const 것들: 랜후보[] = [];
  const nets = networkInterfaces();
  for (const [이름, 목록] of Object.entries(nets)) {
    for (const n of 목록 ?? []) {
      // IPv4 만. 자기 자신(127.x)은 뺍니다 — 휴대폰이 붙을 수 없습니다.
      const family = String((n as any).family);
      if (family !== "IPv4" && family !== "4") continue;
      if (n.internal) continue;
      것들.push({ 이름, 주소: n.address, 사설인가: 사설(n.address) });
    }
  }
  // 사설망 주소를 앞으로. 그중에서도 192.168 이 집·사무실 공유기의 기본입니다.
  return 것들.sort((a, b) =>
    Number(b.사설인가) - Number(a.사설인가) ||
    Number(b.주소.startsWith("192.168.")) - Number(a.주소.startsWith("192.168.")));
}

/** 제일 그럴듯한 하나. 없으면 null (랜선도 와이파이도 없는 PC). */
export function 랜주소(): string | null {
  return 랜주소들()[0]?.주소 ?? null;
}
