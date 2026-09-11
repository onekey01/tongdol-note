/**
 * 편람 서식 원본이 어디 있나.
 *
 * 개발 중에는 프로젝트 폴더의 `서식/`, 만들어서 배포하면 실행 파일 옆의
 * `서식/` 입니다. 서식마다 이 셈을 따로 적어 두었더니 **한 곳을 고치면
 * 다른 곳이 안 따라오는** 자리가 됐습니다. 여기 하나로 모읍니다.
 *
 * 서식은 **원본 그대로** 있어야 합니다 — 우리가 하는 일은 값 칸을 채우는
 * 것뿐이고, 서식 자체는 편람에서 오려낸 것을 손대지 않고 씁니다.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export function 서식폴더(): string {
  for (const p of [
    join(process.cwd(), "서식"),
    join(import.meta.dir, "..", "서식"),
  ]) if (existsSync(p)) return p;
  throw new Error(
    "「서식」 폴더를 못 찾았습니다. 프로그램 폴더 안에 편람 서식이 들어 있는 " +
    "「서식」 폴더가 있어야 합니다."
  );
}
