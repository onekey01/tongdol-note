/**
 * 화면 시험이 **최초 설정 마법사를 눌러서 지나가게** 해 줍니다 (v35).
 *
 * ── 왜 따로 두나 ───────────────────────────────────────────
 *
 * `도구/설정마침.ts` 는 자료함에 바로 적어 넣는 지름길이라 **개발
 * 자료함을 엽니다.** 빈 자료함에 붙어 도는 화면 시험이 그 파일을
 * 부르면 **엉뚱한 자료함**을 건드립니다. 그래서 브라우저로만 하는
 * 이 길은 서버를 아예 안 부르는 파일에 둡니다.
 *
 * ★ 마법사가 안 떠 있으면 **아무것도 안 하고 지나갑니다.**
 *   시험마다 「뜰까 안 뜰까」를 적어 두면 그게 또 어긋납니다.
 */
export async function 마법사지나기(page: any, 기다림 = 3000): Promise<boolean> {
  const 글 = await page.locator("body").innerText().catch(() => "");
  if (!/이 값들이 맞는지만 봐 주세요/.test(글)) return false;
  await page.locator("button.primary").first().click();
  await page.waitForTimeout(기다림);
  return true;
}
