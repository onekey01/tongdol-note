# 우편함(Supabase) 붙는지 보기 — 열쇠 값은 화면에 찍지 않습니다.
#
# 무엇을 어디에 물어보는지가 중요합니다 —
#   휴대폰 열쇠 : /auth/v1/health  (설계도는 못 봅니다. 그게 정상입니다)
#   개발  열쇠 : /rest/v1/        (설계도까지 볼 수 있습니다)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$curl = "$env:SystemRoot\System32\curl.exe"; if (-not (Test-Path $curl)) { $curl = "curl.exe" }

$vals = @{}
foreach ($line in Get-Content (Join-Path $here ".env") -Encoding UTF8) {
  if ($line -match '^\s*TONGDOL_[A-Z_]+\s*=') { $p = $line -split '=',2; $vals[$p[0].Trim()] = $p[1].Trim() }
}
$url = $vals['TONGDOL_SUPABASE_URL']
$pub = $vals['TONGDOL_SUPABASE_PUBLISHABLE_KEY']
$sec = $vals['TONGDOL_SUPABASE_SECRET_KEY']

Write-Host ""
Write-Host "  통돌 Note — 우편함 붙는지 보기" -ForegroundColor Cyan
Write-Host "  ------------------------------------------------"
Write-Host "  주소 : $url" -ForegroundColor DarkGray

$fail = 0
function Check($name, $uri, $key, $want) {
  $code = & $curl -s -o NUL -w "%{http_code}" --max-time 25 -H "apikey: $key" $uri 2>$null
  $ok = ("$code" -eq "$want")
  if (-not $ok) { $script:fail++ }
  Write-Host ("  {0}  {1,-26} HTTP {2}" -f $(if($ok){"  통과"}else{"X 실패"}), $name, $code) `
    -ForegroundColor $(if($ok){"Green"}else{"Red"})
}

Write-Host ""
Check "휴대폰 열쇠 (health)" "$url/auth/v1/health" $pub 200
Check "개발 열쇠 (설계도)"   "$url/rest/v1/"       $sec 200
Check "열쇠 없으면 막히나"   "$url/auth/v1/health" ""   401

# ── 표가 들어갔나 ────────────────────────────────────────
Write-Host ""
Write-Host "  우편함 안에 표가 있나" -ForegroundColor White
$spec = & $curl -s --max-time 25 -H "apikey: $sec" "$url/rest/v1/" 2>$null
foreach ($t in @("org","org_member","worker","worker_device","job","report","photo")) {
  $있나 = $spec -match ('"/' + $t + '"')
  if (-not $있나) { $script:fail++ }
  Write-Host ("  {0}  {1}" -f $(if($있나){"  통과"}else{"X 없음"}), $t) `
    -ForegroundColor $(if($있나){"Green"}else{"Red"})
}
# ── 로그인 없이는 아무것도 못 읽나 ───────────────────────
#
#  ★ 「enroll_token 이 감춰졌나」는 여기서 물을 수 없습니다 ★
#  위 설계도는 개발 열쇠로 받아온 것인데, 개발 열쇠는 권한을 다 무시하고
#  모든 표를 보여 줍니다. 권한 확인은 우편함\002_시험.sql 이 합니다.
#  여기서는 밖에서 확인할 수 있는 것만 봅니다 —
#  「로그인 안 한 열쇠로는 표를 못 읽는다」.
Write-Host ""
Write-Host "  로그인 없이는 못 읽나 (휴대폰 열쇠만으로)" -ForegroundColor White
foreach ($t in @("enroll_token","job","report")) {
  $c = & $curl -s -o NUL -w "%{http_code}" --max-time 20 -H "apikey: $pub" `
       "$url/rest/v1/$t?select=id&limit=1" 2>$null
  $막힘 = ("$c" -ne "200")
  if (-not $막힘) { $script:fail++ }
  Write-Host ("  {0}  {1,-16} HTTP {2}" -f $(if($막힘){"  통과"}else{"X 뚫림"}), $t, $c) `
    -ForegroundColor $(if($막힘){"Green"}else{"Red"})
}

Write-Host ""
Write-Host "  ------------------------------------------------"
if ($fail -eq 0) {
  Write-Host "  전부 통과 — 우편함이 살아 있고 표도 들어갔습니다." -ForegroundColor Green
} else {
  Write-Host "  $fail 가지 실패 — 이 화면을 보내 주세요." -ForegroundColor Red
}
Read-Host "`n  엔터를 누르면 닫힙니다"
