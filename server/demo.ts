/**
 * 예시 종사자 넣기 — **시험용입니다.**
 *
 *   bun run 예시종사자
 *
 * 배정을 시험하려면 담당으로 고를 사람이 있어야 합니다.
 * 한 명씩 손으로 등록하면 시간이 걸려서, 세 사람을 한 번에 넣습니다.
 *
 * 예시 대상자 명단(`서식시험/의뢰명단_예시(배정시험).xlsx`)의 읍면동에 맞춰
 * 사는 곳을 골랐습니다. 그래야 배정할 때 「★같은 읍면동」 표시가 실제로 뜹니다.
 *
 * 세 사람이 서로 다른 경우를 하나씩 맡습니다.
 *   최돌봄  평범한 제공인력. 자격 하나, 교육 하나
 *   김손길  자격이 여럿인 제공인력
 *   정보람  사무직원을 겸하고, 임금은 **별도관리** (다른 사업 인건비로 나감)
 *
 * 이미 같은 아이디가 있으면 건드리지 않고 지나갑니다.
 * 실제 기관 자료함에 대고 실행해도 있던 사람이 지워지지 않습니다.
 */
import { db } from "./db";
import { createStaff } from "./staff";

type Demo = Parameters<typeof createStaff>[0];

const PEOPLE: Demo[] = [
  {
    name: "최돌봄", loginId: "care01", password: "care1234",
    phone: "010-4444-5555", birth: "1975-06-11",
    address: "전남 해남군 해남읍 수성리 18",
    roles: ["worker"], empNo: "W-001",
    hiredOn: "2026-03-02", contractOn: "2026-02-25",
    qualifications: [{ name: "요양보호사 1급", no: "제12345호", on: "2020-05-11" }],
    trainings: [{ name: "인권교육", on: "2026-03-20", hours: "4" }],
  },
  {
    name: "김손길", loginId: "care02", password: "care1234",
    phone: "010-3333-7788", birth: "1968-02-27",
    address: "전남 해남군 현산면 월송리 40",
    roles: ["worker"], empNo: "W-002",
    hiredOn: "2025-11-04", contractOn: "2025-10-28",
    qualifications: [
      { name: "요양보호사 1급", no: "제33210호", on: "2018-09-03" },
      { name: "사회복지사 2급", no: "제88123호", on: "2015-02-20" },
    ],
    trainings: [
      { name: "인권교육", on: "2026-03-20", hours: "4" },
      { name: "안전교육", on: "2026-04-08", hours: "2" },
    ],
  },
  {
    name: "정보람", loginId: "care03", password: "care1234",
    phone: "010-8822-1190", birth: "1982-10-05",
    address: "전남 해남군 송지면 산정리 7",
    // 사무직원을 겸합니다. 관리자가 제공인력을 겸하는 것과 같은 구조입니다.
    roles: ["worker", "staff"], empNo: "W-003",
    hiredOn: "2024-01-15", contractOn: "2024-01-10",
    qualifications: [{ name: "사회복지사 1급", no: "제55019호", on: "2012-08-14" }],
    trainings: [{ name: "인권교육", on: "2026-03-20", hours: "4" }],
    // 이미 복지관 정규직이라 이 사업 인건비로 계산하면 정산이 틀어집니다.
    // 실적과 일지는 그대로 쌓이고, 임금 계산에서만 빠집니다.
    payrollExcluded: true,
    excludeReason: "복지관 정규직 — 타 사업 인건비로 지급",
  },
];

const has = (loginId: string) =>
  !!db.query("SELECT id FROM app_user WHERE login_id = ?").get(loginId);

let 넣음 = 0;
for (const p of PEOPLE) {
  if (has(p.loginId!)) {
    console.log(`  건너뜀  ${p.name} (${p.loginId}) — 이미 있습니다`);
    continue;
  }
  await createStaff(p);
  넣음++;
  console.log(`  넣음    ${p.name} (${p.loginId})`);
}

console.log("");
if (넣음 > 0) {
  console.log(`  ${넣음}명을 넣었습니다. 비밀번호는 셋 다 care1234 입니다.`);
  console.log("  「종사자」 화면에서 확인하시고, 「배정·주간계획」에서 담당으로 고르시면 됩니다.");
} else {
  console.log("  새로 넣은 사람이 없습니다.");
}
