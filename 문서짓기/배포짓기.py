# -*- coding: utf-8 -*-
"""
새 버전 내보내기 — 무무 님이 보시는 종이.

★ 기관에 나가는 문서가 아닙니다. 「업데이트 올리는 법.md」와 같은 내용을
  **처음 보는 사람이 그대로 따라 할 수 있게** 화면 그림까지 넣어 다시 쓴 것입니다.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from 짓기 import 짓기

몸 = r"""
<div class="큰일" style="margin-top:2.4rem">
  <p class="머릿말">지금 그대로 두면 — 기관은 새 버전 알림을 영영 못 받습니다</p>
  <p>자동 갱신은 <b>다 만들어져 있습니다.</b> 그런데 <b>서명 열쇠가 비어 있어</b>
     프로그램이 어떤 새 버전도 받지 않습니다. 일부러 그렇게 만들었습니다 —
     「열쇠가 없으니 그냥 믿자」로 빠지는 길을 두면 언젠가 그리로 갑니다.</p>
  <p style="margin-bottom:0">화면에는 <b>아무 표시도 안 뜹니다.</b> 조용히 아무 일도 안
     일어나는 고장이라, 안 하면 안 했다는 것조차 모르고 몇 달이 갑니다.</p>
  <p class="작게" style="margin:.8rem 0 0; color:#cfe3d4">※ 2026-09-11 에 <b>1·2 단계는 끝냈습니다.</b>
     이 종이는 이제 <b>3 → 4 → 6 → 7 → 8</b> 을 보시면 됩니다.</p>
</div>

<h2>지금 어디까지 되어 있나</h2>
<div class="표감"><table>
  <thead><tr><th style="width:14rem">무엇</th><th style="width:6rem">상태</th><th>뜻</th></tr></thead>
  <tbody>
    <tr><td><b>자동 갱신 기능</b></td><td>✅ 됨</td>
        <td>프로그램 안에 다 들어 있습니다. 켜기만 하면 됩니다</td></tr>
    <tr><td><b>서명 열쇠</b></td><td>✅ 됨</td>
        <td>2026-09-11 에 만들었습니다 — <b>1단계는 건너뛰셔도 됩니다</b></td></tr>
    <tr><td><b>GitHub 저장소</b></td><td>✅ 있음</td>
        <td><span class="길">onekey01/tongdol-note</span> — v1.21.36 릴리스까지 올라갔습니다 →
            <b>2단계도 건너뛰셔도 됩니다</b></td></tr>
    <tr><td><b>소스(만든 글)</b></td><td>❌ 아직</td>
        <td>아직 <b>이 PC 한 대에만</b> 있습니다 → <b>6단계</b></td></tr>
    <tr><td><b>기관에 깔린 버전</b></td><td>1.19.35 또는<br>1.21.36</td>
        <td>이 버전에는 <b>열쇠가 없습니다.</b> 그래서 <b>이번 한 번은 손으로</b> → <b>5단계</b></td></tr>
  </tbody>
</table></div>

<h2>전체 순서</h2>
<div class="차례" style="margin-bottom:2rem">
  <ol>
    <li><b>딱 한 번</b> — 서명열쇠 만들기.bat 두 번 누르기<em>2분</em></li>
    <li><b>딱 한 번</b> — GitHub 저장소 만들기<em>3분</em></li>
    <li>매번 — 이번에 바뀐 것.txt 적기<em>3분</em></li>
    <li>매번 — 통돌Note 만들기.bat 두 번 누르기<em>10~15분</em></li>
    <li><b>이번만</b> — 기관에 손으로 건네기<em>10분</em></li>
    <li>매번 — 소스를 GitHub 에 올리기<em>3분</em></li>
    <li>매번 — GitHub 에 파일 세 개 올리기<em>5분</em></li>
    <li>매번 — 됐는지 확인하기<em>1분</em></li>
  </ol>
</div>

<p class="작게">1·2 는 <b>평생 한 번</b>입니다. 5 는 <b>이번 버전만</b>입니다.
   다음 버전부터는 3 → 4 → 6 → 7 → 8 만 하시면 되고, 다 합쳐 25분쯤입니다.</p>

<div class="못박기">
  일하시는 폴더는 늘 여기입니다<br>
  <span class="길" style="color:#cfe3d4">C:\Users\Bak Byeongseob\Desktop\care-saas\chaengkim-note</span>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">1</div>
  <div class="속살">
    <h2>서명 열쇠 만들기</h2>
    <p class="걸림">2분 · 평생 한 번 · 안 하면 나머지가 다 헛일입니다</p>

    <h3>1-가. 파일 찾아서 두 번 누르기</h3>
    <p>탐색기에서 이 폴더를 엽니다.</p>
    <div class="검은창"><span class="흐리게">C:\Users\Bak Byeongseob\Desktop\care-saas\</span><span class="밝게">chaengkim-note</span></div>
    <p>그 안에 있는 <span class="누름">서명열쇠 만들기.bat</span> 를 <b>두 번 누릅니다.</b>
       검은 창이 하나 뜹니다.</p>

    <h3>1-나. GitHub 주인 이름 한 번 치기</h3>
    <p>검은 창이 이렇게 묻습니다.</p>
    <div class="검은창"><span class="흐리게">  통돌 Note — 업데이트 서명 열쇠 만들기</span>
<span class="흐리게">  ─────────────────────────────────────────</span>

<span class="흐리게">  버전을 올려 둘 자리를 정합니다.</span>
<span class="흐리게">  GitHub 주소가 이런 모양이면 —</span>
<span class="흐리게">      https://github.com/【주인이름】/tongdol-note</span>

<span class="흐리게">  GitHub 주인 이름: </span><span class="밝게">onekey01</span>  <span class="흐리게">← 치고 엔터</span></div>

    <div class="조심">
      <p class="머릿말">여기서 무엇을 치나</p>
      <p><b>GitHub 계정 이름</b>입니다. 이메일이 아닙니다. 비밀번호도 아닙니다.</p>
      <p style="margin-bottom:0">GitHub 에 로그인하면 오른쪽 위 동그란 사진을 눌렀을 때
         <b>Signed in as <u>○○○</u></b> 로 보이는 그 이름입니다.
         영문·숫자·붙임표(-)만 됩니다.</p>
    </div>

    <h3>1-다. 이런 말이 나오면 된 것입니다</h3>
    <div class="검은창"><span class="흐리게">  다 됐습니다.</span>

<span class="흐리게">    개인 열쇠   </span><span class="밝게">C:\Users\Bak Byeongseob\통돌Note-서명열쇠\개인열쇠.pem</span>
<span class="흐리게">                ← 남에게 보내지 마세요. 한 부 더 두세요.</span>
<span class="흐리게">    공개 열쇠   server\업데이트열쇠.ts 에 넣었습니다</span>
<span class="흐리게">    올릴 자리   https://github.com/onekey01/tongdol-note/releases/latest/download</span></div>

    <h3>1-라. 정말 들어갔는지 눈으로 확인</h3>
    <p><span class="길">chaengkim-note\server\업데이트열쇠.ts</span> 를
       <b>메모장으로 열어</b> 아래로 내려가 이 줄을 찾습니다.</p>
    <div class="표감"><table>
      <thead><tr><th style="width:8rem">언제</th><th>그 줄이 이렇게 보입니다</th></tr></thead>
      <tbody>
        <tr><td><b>하기 전</b></td>
            <td><span class="길">export const 공개열쇠 = "";</span> ← 따옴표 사이가 비어 있음</td></tr>
        <tr><td><b>하고 나면</b></td>
            <td><span class="길">export const 공개열쇠 = "MCowBQYDK2Vw…";</span>
                ← 알 수 없는 글자가 40~50자쯤</td></tr>
      </tbody>
    </table></div>
    <p class="작게">글자 내용은 아무 뜻 없습니다. <b>비어 있지만 않으면</b> 된 것입니다.</p>

    <div class="큰일">
      <p class="머릿말">개인열쇠.pem — 이 파일만은 지켜 주세요</p>
      <p>이 파일을 가진 사람은 <b>기관 PC 가 믿는 새 버전을 만들 수 있습니다.</b>
         진짜 통돌 Note 인 척하는 프로그램을 기관에 밀어 넣을 수 있다는 뜻입니다.</p>
      <ul style="margin-bottom:.6rem">
        <li><b>남에게 보내지 마세요</b> — 메일에도, 카톡에도, 클라우드에도.</li>
        <li><b>프로젝트 폴더 안으로 옮기지 마세요</b> — 그러면 언젠가 zip 에 딸려
            들어가 기관에 나갑니다. 그 순간 서명은 아무 뜻도 없어집니다.</li>
        <li><b>USB 에 한 부 더 두세요</b> — 잃어버리면 새 열쇠를 만들어야 하고,
            <b>이미 나가 있는 기관은 전부 손으로 한 번 갈아 끼워야</b> 합니다.</li>
      </ul>
      <p style="margin-bottom:0">파일이 있는 자리 —
         <span class="길">C:\Users\Bak Byeongseob\통돌Note-서명열쇠\</span></p>
    </div>

    <div class="짚기">
      <p style="margin-bottom:0"><b>실수로 두 번 눌러도 괜찮습니다.</b>
         이미 열쇠가 있으면 <span class="뜬말">이미 있습니다</span> 라고 말하고
         <b>덮어쓰지 않고 그냥 끝납니다.</b></p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">2</div>
  <div class="속살">
    <h2>GitHub 저장소 만들기</h2>
    <p class="걸림">3분 · 평생 한 번</p>

    <h3>2-가. 먼저 이미 있는지 봅니다</h3>
    <p>브라우저에 이 주소를 칩니다.</p>
    <div class="검은창"><span class="밝게">https://github.com/onekey01/tongdol-note</span></div>
    <div class="표감"><table>
      <thead><tr><th style="width:10rem">보이는 것</th><th>하실 일</th></tr></thead>
      <tbody>
        <tr><td><b>저장소 화면</b></td><td>이미 있습니다. <b>2단계는 건너뛰세요.</b></td></tr>
        <tr><td><b>404</b></td><td>없습니다. 아래 2-나 로 가세요.</td></tr>
      </tbody>
    </table></div>

    <h3>2-나. 만들기</h3>
    <ol class="흐름">
      <li><b>github.com 에 로그인합니다</b>
          <span>계정이 없으면 <span class="길">github.com/signup</span> 에서 먼저 만드세요.
                이메일과 비밀번호만 있으면 되고 돈은 안 듭니다.</span></li>
      <li><b>주소창에 <span class="길">github.com/new</span> 를 칩니다</b>
          <span>「새 저장소 만들기」 화면이 뜹니다.</span></li>
      <li><b>Repository name 칸에 <span class="길">tongdol-note</span></b>
          <span>★ <b>이 이름 그대로</b>여야 합니다. 프로그램에 박혀 있습니다.
                대문자·띄어쓰기·한글 안 됩니다.</span></li>
      <li><b>바로 아래에서 <span class="누름">Public</span> 을 고릅니다</b>
          <span>Private 이면 기관 프로그램이 파일을 못 받습니다 — 아래 상자를 보세요.</span></li>
      <li><b>나머지는 아무것도 건드리지 않습니다</b>
          <span>README·.gitignore·license 전부 체크 안 해도 됩니다.</span></li>
      <li><b>맨 아래 초록 단추 <span class="누름">Create repository</span></b>
          <span>만들어지면 끝입니다. 파일을 넣거나 할 일 없습니다.</span></li>
    </ol>

    <div class="조심">
      <p class="머릿말">왜 Public 인가 — 자료가 새는 것 아닌가</p>
      <p>Private 저장소의 파일은 <b>열쇠가 있어야 받을 수 있습니다.</b> 그러면 그 열쇠를
         기관 프로그램에 넣어 보내야 하는데, 그건 exe 안에 들어가니
         <b>누구나 꺼낼 수 있습니다.</b> 숨긴 셈이 안 됩니다.</p>
      <p style="margin-bottom:0">Public 이어도 <b>소스는 안 올립니다.</b> 올리는 것은 완성된
         파일 세 개뿐이고, 그건 어차피 기관에 나가는 물건입니다.
         <b>대상자 자료는 한 글자도 안 올라갑니다</b> — 그건 기관 PC 에만 있습니다.</p>
    </div>

    <div class="큰일">
      <p class="머릿말">주인 이름이 다르면 안 됩니다</p>
      <p style="margin-bottom:0">1단계에서 <span class="뜬말">onekey01</span> 이라고 치셨다면
         저장소도 <b>그 계정으로</b> 만드셔야 합니다. 다른 계정에 만들면
         프로그램이 엉뚱한 주소를 보게 되어 <b>영영 못 찾습니다.</b></p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">3</div>
  <div class="속살">
    <h2>이번에 바뀐 것 적기</h2>
    <p class="걸림">3분 · 버전마다</p>

    <p><span class="길">chaengkim-note\이번에 바뀐 것.txt</span> 를
       <b>메모장으로 엽니다.</b></p>
    <p>맨 위 <span class="길">#</span> 로 시작하는 줄들은 설명이라 <b>안 나갑니다.</b>
       그 아래에 <b>지난 버전 내용이 남아 있으면 지우고</b>, 이번에 바뀐 것을
       <b>한 줄에 하나씩</b> 적습니다.</p>

    <div class="짚기">
      <p><b>이번 버전(1.22.36)은 이렇게 적으시면 됩니다</b> — 그대로 복사해 붙이셔도 됩니다.</p>
      <div class="검은창" style="margin-bottom:0">바탕화면 아이콘이 흐릿하게 나오던 것을 고쳤습니다
설치 안내와 사용설명서에 실제 화면 그림이 들어갔습니다. 브라우저에서 열어 보시면 됩니다
지자체에 내는 기록지에 값이 파란 기울임 글씨로 나가던 것을 고쳤습니다. 이제 검은 글씨로 나갑니다
설정에서 서비스마다 1회 서비스 시간을 정할 수 있습니다. 배정할 때마다 손으로 적지 않으셔도 됩니다
계획을 세울 때 1회 시간을 안 적으면 1시간으로 봅니다. 전에는 3시간으로 보아 주 2회 배정이 막혔습니다
설정 화면에서 20분·45분·80분처럼 30분 단위가 아닌 값도 적을 수 있습니다
최초 설정에서 한도 칸을 비우고 넘어가면 한도가 없는 것으로 저장되던 것을 막았습니다
직접 넣은 대상자가 배정 화면에 안 보이던 까닭을 화면이 알려 드립니다
제공인력 휴대폰이 아직 안 이어져 있으면 홈에서 알려 드립니다
못 간 사유를 눌러서 고르게 바뀌었습니다. 전에는 손으로 쳐야 했습니다</div>
    </div>

    <div class="표감"><table>
      <thead><tr><th style="width:10rem">규칙</th><th>내용</th></tr></thead>
      <tbody>
        <tr><td><b>길이</b></td><td>스무 줄까지, 한 줄 120자까지</td></tr>
        <tr><td><b># 줄</b></td><td>안 나갑니다 (설명용)</td></tr>
        <tr><td><b>저장</b></td><td>인코딩은 신경 안 쓰셔도 됩니다</td></tr>
        <tr><td><b>비어 있으면</b></td><td><b>만들기가 멈춥니다.</b> 일부러 그렇게 해 두었습니다</td></tr>
      </tbody>
    </table></div>

    <div class="조심">
      <p class="머릿말">「버그 수정 및 안정성 개선」은 아무 말도 안 한 것입니다</p>
      <p style="margin-bottom:0">이 줄들이 <b>기관 화면에 그대로 뜹니다.</b> 기관은 이것을 읽고
         깔지 말지를 정합니다. 무슨 말인지 모르면 <b>안 깝니다.</b>
         그리고 안 깐 채로 몇 달이 갑니다.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">4</div>
  <div class="속살">
    <h2>통돌Note 만들기.bat</h2>
    <p class="걸림">10~15분 · 버전마다 · 두 가지만 물어봅니다</p>

    <p><span class="누름">통돌Note 만들기.bat</span> 를 <b>두 번 누릅니다.</b>
       검은 창이 뜨고 한참 돕니다. <b>두 번 묻습니다.</b></p>

    <h3>물음 ① 버전 번호</h3>
    <div class="검은창"><span class="흐리게">  지금 버전 번호는  v1.21.36  입니다.</span>
<span class="흐리게">  맨 뒷자리(36)는 자료함 구조라 프로그램이 붙입니다 — 손대지 않습니다.</span>

<span class="흐리게">  고친 것을 내보내는 것이면 앞 두 자리를 올려 주세요 (예: 1.21 → 1.22).</span>
<span class="흐리게">  그대로 두시려면 그냥 엔터.</span>
<span class="흐리게">  새 앞 두 자리: </span><span class="밝게">1.22</span>  <span class="흐리게">← 이렇게 치고 엔터</span></div>

    <p><b>이번에는 <span class="길">1.22</span> 을 치십시오.</b> 그러면 버전이
       <b>1.22.36</b> 이 됩니다.</p>
    <div class="짚기">
      <p style="margin-bottom:0"><b>왜 올리나</b> — <b>1.21.36 은 이미 릴리스했습니다.</b> GitHub 은 같은 태그를 두 번 못 씁니다. 그리고 1.21.36 꾸러미에는 <b>그림 없는 옛 설명서</b>가 실려 나갔습니다 — 문서를 짓는 자리와 배포본이 집어 가는 자리가 달랐습니다. 그것을 고쳤으니 <b>한 칸 더 올려서</b> 다시 냅니다.</p>
    </div>

    <h3>물음 ② 꼭 해야 하는 버전인가</h3>
    <div class="검은창"><span class="흐리게">  이 버전은 셈이 틀리던 것을 고친 버전입니까?</span>
<span class="흐리게">  (그런 버전을 안 깔면 엉뚱한 청구서가 어르신께 갑니다.)</span>
<span class="흐리게">  꼭 해야 하는 버전이면 y, 아니면 그냥 엔터: </span><span class="밝게">y</span>  <span class="흐리게">← 이렇게 치고 엔터</span></div>

    <p><b><span class="길">y</span> 를 치십시오.</b></p>
    <div class="짚기">
      <p style="margin-bottom:0">파일럿 동안은 <b>버그 고침이 자주 나가므로</b>
         <span class="길">y</span> 로 내보내기로 무무 님이 정하셨습니다(2026-09-11).
         아껴 쓰실 때가 오면 그때 그냥 엔터로 바꾸시면 됩니다.</p>
    </div>

    <h3>다 되면 이렇게 끝납니다</h3>
    <div class="검은창"><span class="흐리게">  다 됐습니다.</span>

<span class="흐리게">    폴더    </span><span class="밝게">통돌Note_1.22.36</span>
<span class="흐리게">    압축    </span><span class="밝게">통돌Note_1.22.36.zip</span><span class="흐리게">   ← 기관에는 이 파일 하나만 보내면 됩니다</span>

<span class="흐리게">    올릴것  ← GitHub 에 이 폴더 안의 세 파일을 올리시면 됩니다</span></div>

    <p><b>탐색기가 「올릴것」 폴더를 저절로 열어 줍니다.</b> 안에 딱 세 개가 있어야 합니다.</p>
    <div class="검은창"><span class="흐리게">  올릴것\</span>
    <span class="밝게">version.json</span>                    <span class="흐리게">버전 번호 · 날짜 · 바뀐 것 · 지문</span>
    <span class="밝게">version.json.sig</span>                <span class="흐리게">그 파일에 찍은 서명</span>
    <span class="밝게">tongdol-note-1.22.36.zip</span>        <span class="흐리게">프로그램 (40MB쯤)</span></div>

    <div class="큰일">
      <p class="머릿말">「올릴것」 폴더가 안 열리면 1단계를 안 하신 것입니다</p>
      <p style="margin-bottom:0">검은 창에 <span class="뜬말">⚠ 서명 열쇠가 없습니다</span> 가
         떴을 것입니다. <b>1단계로 돌아가세요.</b> zip 은 멀쩡히 만들어졌으니 손으로 건네는
         길은 살아 있지만, 자동 갱신은 이번에도 안 켜집니다.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">5</div>
  <div class="속살">
    <h2>★ 이번 한 번은 기관에 손으로</h2>
    <p class="걸림">10분 · <b>이번 버전만</b> · 다음부터는 안 하셔도 됩니다</p>

    <div class="큰일">
      <p class="머릿말">먼저 — 기관 PC 가 어느 버전인지 보십시오</p>
      <p>기관 PC 에서 프로그램을 켜고 <b>설정 → 이 프로그램</b> 을 보면 번호가 있습니다.</p>
      <div class="표감" style="margin:.6rem 0 0"><table>
        <thead><tr><th style="width:9rem">거기 적힌 번호</th><th>이번에 하실 일</th></tr></thead>
        <tbody>
          <tr><td><b>1.19.35</b></td>
              <td>★ <b>이 단계를 하셔야 합니다.</b> 그 버전에는 <b>공개 열쇠가 없어</b>
                  새 버전을 봐도 서명을 확인할 수 없어 받지 않습니다. 손으로 한 번만
                  넣어 드리면 그 다음부터 저절로 뜹니다</td></tr>
          <tr><td><b>1.21.36</b></td>
              <td>✅ <b>이 단계는 건너뛰십시오.</b> 그 안에 열쇠가 들어 있습니다.
                  기관은 다음에 켤 때 <b>1.22.36 띠를 저절로 봅니다</b></td></tr>
        </tbody>
      </table></div>
      <p style="margin:.8rem 0 0">손으로 가는 일은 <b>열쇠 없는 버전에 한 번뿐</b>입니다.</p>
    </div>

    <h3>무엇을 가져가나</h3>
    <p><b>파일 하나입니다</b> — <span class="길">통돌Note_1.22.36.zip</span>.
       USB 에 담아 가시거나 메일로 보내시면 됩니다.</p>

    <h3>기관 PC 에서 하는 일</h3>
    <ol class="흐름">
      <li><b>zip 을 오른쪽 눌러 <span class="누름">압축 풀기</span></b>
          <span>바탕화면에 푸시면 편합니다. ★ 압축을 안 풀고 안에서 바로 실행하면
                자료가 임시 폴더에 쌓이다 사라집니다.</span></li>
      <li><b>풀린 폴더의 <span class="누름">통돌Note 설치.bat</span> 두 번 누르기</b>
          <span>어디에 넣을지 묻습니다.</span></li>
      <li><b>「어디에 넣을까요?」 에 그냥 엔터</b>
          <span>★ <b>지금 깔려 있는 그 자리</b>(대개 <span class="길">C:\통돌Note</span>)여야 합니다.
                같은 자리면 <b>프로그램만 갈아 끼우고 자료함은 손도 대지 않습니다.</b></span></li>
      <li><b>바탕화면 아이콘으로 켜서 확인</b>
          <span>설정 → 이 프로그램 → 버전에 <b>1.22.36</b> 이 보이면 된 것입니다.</span></li>
    </ol>

    <div class="큰일">
      <p class="머릿말">새 폴더에 따로 풀어서 켜지 마세요</p>
      <p style="margin-bottom:0">대상자가 하나도 없는 빈 프로그램이 열립니다.
         <b>자료가 지워진 것이 아니라</b> 옛 폴더에 그대로 있습니다.
         그래도 기관은 그 자리에서 새파랗게 질립니다.</p>
    </div>

    <div class="조심">
      <p class="머릿말">백신이 한마디 할 수 있습니다</p>
      <p style="margin-bottom:0">서명 인증서가 없는 exe 라 바꾸는 그 순간 백신이 잠깐 잡을 수
         있습니다. <b>이번은 옆에서 직접 보시는 것이 좋습니다.</b> 잡히더라도 자료는 안전합니다 —
         옛 것은 <span class="길">이전버전\</span> 에 그대로 있고
         <span class="길">data\</span> 는 건드린 적이 없습니다.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">6</div>
  <div class="속살">
    <h2>소스를 GitHub 에 올리기</h2>
    <p class="걸림">3분 · 버전마다 · 처음 한 번만 git 깔기(5분)</p>

    <div class="조심">
      <p class="머릿말">이것은 「배포」가 아닙니다</p>
      <p style="margin-bottom:0">기관이 받는 새 버전은 <b>다음 7단계의 Release</b> 입니다.
         이 단계가 하는 일은 <b>만든 글(소스)을 GitHub 에 남겨 두는 것</b>뿐이고,
         기관 쪽에는 아무 일도 일어나지 않습니다.</p>
    </div>

    <h3>왜 하나</h3>
    <div class="표감"><table>
      <thead><tr><th style="width:11rem">지금</th><th>올려 두면</th></tr></thead>
      <tbody>
        <tr><td><b>PC 한 대에만 있습니다</b></td>
            <td>그 PC 가 죽으면 <b>통돌 Note 는 사라집니다.</b> 올려 두면 남습니다</td></tr>
        <tr><td><b>되돌릴 수 없습니다</b></td>
            <td>「어제는 됐는데 오늘 안 되네」일 때 <b>어제 것으로</b> 돌아갈 수 있습니다</td></tr>
        <tr><td><b>무엇을 고쳤는지 기억에만</b></td>
            <td>버전마다 <b>한 줄 설명과 날짜</b>가 같이 남습니다</td></tr>
      </tbody>
    </table></div>

    <div class="큰일">
      <p class="머릿말">먼저 정하셔야 할 것 — 소스가 남에게 보입니다</p>
      <p>기관 프로그램은 <b>로그인 없이</b> Release 를 받아 가야 합니다. 그래서
         그 저장소는 <b>공개</b>라야 하고, 같은 저장소에 올린 <b>소스도 누구나
         볼 수 있게 됩니다.</b></p>
      <p style="margin-bottom:0">소스를 안 보이게 두고 싶으시면, GitHub 에서
         <b>비공개(Private) 저장소를 하나 더</b> 만들고 첫 실행 때 그 주소를 치시면 됩니다.
         Release 는 지금 쓰던 공개 저장소 그대로 갑니다. <b>둘은 따로 놉니다.</b></p>
    </div>

    <h3>6-가. 처음 한 번 — git 깔기</h3>
    <p><span class="누름">깃 올리기.bat</span> 를 두 번 누릅니다.
       git 이 없으면 검은 창이 이렇게 알려 줍니다.</p>
    <div class="검은창"><span class="흐리게">  이 컴퓨터에 git 이 없습니다.</span>

<span class="흐리게">    받는 곳   https://git-scm.com/download/win</span>
<span class="흐리게">    고를 것   64-bit Git for Windows Setup</span>
<span class="흐리게">    까는 법   묻는 것을 다 그대로 두고 Next 만 계속 누르면 됩니다</span>

<span class="흐리게">  받는 곳을 지금 열까요? (Y / N): </span><span class="밝게">Y</span></div>
    <p><b>Next 만 누르시면 됩니다.</b> 고를 것이 많이 나오는데 하나도 안 건드려도 됩니다.
       다 깔고 나면 <b>검은 창을 닫았다가</b> <span class="누름">깃 올리기.bat</span> 를 다시 누르세요.
       (창을 닫아야 새로 깔린 git 을 찾습니다.)</p>

    <h3>6-나. 처음 한 번 — 세 가지 묻습니다</h3>
    <div class="검은창"><span class="흐리게">  이 폴더는 아직 git 저장소가 아닙니다. 처음 한 번 준비하겠습니다.</span>

<span class="흐리게">  소스를 올릴 자리</span>
<span class="흐리게">    https://github.com/onekey01/tongdol-note.git</span>

<span class="흐리게">  이 주소로 올릴까요? (엔터 = 예 / 다른 주소면 여기 붙여넣기): </span><span class="밝게">↵</span>

<span class="흐리게">  기록에 남길 이름을 적어 주세요. (GitHub 계정 이름이면 됩니다)</span>
<span class="흐리게">  이름: </span><span class="밝게">onekey01</span>

<span class="흐리게">  기록에 남길 메일 주소를 적어 주세요. (GitHub 에 쓰시는 그 주소)</span>
<span class="흐리게">  메일: </span><span class="밝게">onekey01@gmail.com</span>

<span class="흐리게">  준비 끝. 가지 이름은 main 입니다.</span></div>
    <p class="작게">주소는 <span class="길">server\업데이트열쇠.ts</span> 에 박혀 있는 것을 저절로 읽어 옵니다.
       그대로 쓰실 것이면 <b>엔터만</b> 치시면 됩니다.</p>

    <h3>6-다. 매번 — 무엇이 올라가는지 보고 한 줄 적기</h3>
    <div class="검은창"><span class="흐리게">  올라갈 파일 4 개</span>
<span class="흐리게">  ────────────────────────────────────────────────────</span>
<span class="흐리게">    도구/아이콘.ico</span>
<span class="흐리게">    도구/아이콘만들기.py</span>
<span class="흐리게">    build.ps1</span>
<span class="흐리게">    아이콘시험.ts</span>
<span class="흐리게">  ────────────────────────────────────────────────────</span>

<span class="흐리게">  무엇을 고쳤는지 한 줄로 적어 주세요.</span>
<span class="흐리게">  한 줄 설명 (그냥 엔터 = v1.22.0 손질): </span><span class="밝게">아이콘 목차 고침</span>

<span class="흐리게">  기록으로 묶었습니다 — 아이콘 목차 고침</span>

<span class="흐리게">  GitHub 로 보냅니다...</span>
<span class="흐리게">  (처음이면 로그인 창이 한 번 뜹니다. GitHub 계정으로 들어가시면 됩니다.)</span>

<span class="흐리게">  다 됐습니다.</span>

<span class="흐리게">    올린 자리   </span><span class="밝게">https://github.com/onekey01/tongdol-note</span>
<span class="흐리게">    가지        main</span>
<span class="흐리게">    쌓인 기록   7 개</span></div>

    <div class="조심">
      <p class="머릿말">로그인 창이 한 번 뜹니다</p>
      <p style="margin-bottom:0">처음 보낼 때 <b>GitHub 로그인 창</b>이 뜹니다.
         브라우저에서 계정으로 들어가시면 되고, <b>그 뒤로는 안 뜹니다.</b>
         창을 그냥 닫으면 「보내지 못했습니다」로 끝나니, 다시 누르시면 창이 또 뜹니다.</p>
    </div>

    <div class="큰일">
      <p class="머릿말">열쇠가 든 파일은 못 올라가게 막아 뒀습니다 — 세 겹으로</p>
      <p><span class="길">.env</span> 에는 우편함(Supabase) 열쇠가 들어 있습니다.
         이런 파일은 <b>한 번 GitHub 에 올라가면 지워도 기록에 남습니다.</b>
         그래서 올리기 <b>전에</b> 멈춥니다.</p>
      <div class="표감" style="margin:.6rem 0"><table>
        <thead><tr><th style="width:5rem">보는 것</th><th>무엇을</th></tr></thead>
        <tbody>
          <tr><td><b>① 이름</b></td><td><span class="길">.env</span> ·
              <span class="길">.pem</span> 처럼 열쇠로 보이는 이름</td></tr>
          <tr><td><b>② 묶음</b></td><td><span class="길">.tgz</span> ·
              <span class="길">.zip</span> 은 <b>아예 안 올립니다.</b>
              안에 무엇이 들었는지 이름만 봐서는 알 수 없습니다</td></tr>
          <tr><td><b>③ 속</b></td><td>올라갈 글 파일의 <b>내용</b>을 훑어
              열쇠 모양을 찾습니다. <span class="길">.ts</span> 한가운데
              붙여 넣어도 걸립니다</td></tr>
        </tbody>
      </table></div>
      <p style="margin:0 0 .6rem"><b>② 는 2026-09-11 에 실제로 뚫린 자리입니다.</b>
         <span class="길">_to_delete\_ship.tgz</span> <b>묶음 안에</b>
         <span class="길">.env</span> 가 들어 있었고, 이름이 <span class="길">.tgz</span> 라
         그냥 지나갔습니다. 그때는 ① 만 있었습니다.</p>
      <div class="검은창" style="margin:.6rem 0 0"><span class="흐리게">  ████ 멈췄습니다 — 열쇠가 든 파일이 올라갈 뻔했습니다 ████</span>

<span class="흐리게">    .env</span>

<span class="흐리게">  ... 아무것도 올리지 않았습니다.</span></div>
      <p style="margin:.8rem 0 0">이 창이 뜨면 <b>아무것도 안 올라갔습니다.</b>
         <span class="길">.gitignore</span> 를 손보고 다시 누르시면 됩니다.</p>
    </div>

    <p class="작게">두 번째부터는 묻는 것이 <b>한 줄 설명 하나뿐</b>입니다. 3분이면 끝납니다.</p>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">7</div>
  <div class="속살">
    <h2>GitHub 에 파일 세 개 올리기</h2>
    <p class="걸림">5분 · 버전마다 · <b>여기가 제일 틀리기 쉽습니다</b></p>

    <ol class="흐름">
      <li><b><span class="길">https://github.com/onekey01/tongdol-note</span> 로 갑니다</b></li>
      <li><b>오른쪽 기둥에서 <span class="누름">Releases</span> 를 누릅니다</b>
          <span>처음이면 <span class="누름">Create a new release</span>,
                다음부터는 <span class="누름">Draft a new release</span>.</span></li>
      <li><b><span class="누름">Choose a tag</span> 를 누르고 <span class="길">v1.22.36</span> 을 칩니다</b>
          <span>치고 나면 아래에 <span class="누름">+ Create new tag: v1.22.36 on publish</span>
                가 뜹니다. <b>그것을 눌러야</b> 태그가 만들어집니다.</span></li>
      <li><b>Release title 에 <span class="길">v1.22.36</span></b>
          <span>태그와 똑같이 두시면 됩니다.</span></li>
      <li><b>아래 <span class="누름">Attach binaries by dropping them here</span> 자리에
             「올릴것」 폴더의 <b>세 파일을 통째로 끌어다 놓습니다</b></b>
          <span>zip 이 40MB 라 1~3분 걸립니다. <b>세 개 다 Uploaded 로 바뀔 때까지</b> 기다리세요.
                하나라도 올라가는 중에 Publish 를 누르면 안 됩니다.</span></li>
      <li><b>맨 아래 <span class="누름">Publish release</span></b>
          <span>이걸 안 누르면 Draft(초안)로만 남아 아무도 못 받습니다.</span></li>
    </ol>

    <div class="큰일">
      <p class="머릿말">태그는 반드시 v + 버전 번호 — 세 자리 전부</p>
      <div class="표감" style="margin:.6rem 0 0"><table>
        <thead><tr><th style="width:9rem">이렇게</th><th style="width:5rem">되나</th><th>까닭</th></tr></thead>
        <tbody>
          <tr><td><span class="길">v1.22.36</span></td><td>✅</td><td>맞습니다</td></tr>
          <tr><td><span class="길">1.22.36</span></td><td>❌</td><td>앞에 <b>v</b> 가 없습니다</td></tr>
          <tr><td><span class="길">v1.22</span></td><td>❌</td><td>뒷자리(36)가 빠졌습니다</td></tr>
          <tr><td><span class="길">V1.22.36</span></td><td>❌</td><td>대문자 V 는 다른 글자입니다</td></tr>
        </tbody>
      </table></div>
      <p style="margin:.8rem 0 0"><b>만들기 창 맨 끝에 써야 할 태그가 그대로 찍혀 나옵니다.</b>
         그것을 보고 넣으시면 틀릴 일이 없습니다.</p>
    </div>

    <div class="조심">
      <p class="머릿말">version.json 을 GitHub 에서 손으로 고치지 마세요</p>
      <p style="margin-bottom:0">한 글자만 고쳐도 서명이 어긋나 기관 프로그램이 <b>아예 안 받습니다.</b>
         고칠 것이 있으면 <span class="뜬말">이번에 바뀐 것.txt</span> 를 고치고
         <b>만들기를 다시 돌리십시오.</b> 그리고 <b>세 파일을 늘 같이</b> 올리세요.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<div class="단계">
  <div class="번호">8</div>
  <div class="속살">
    <h2>됐는지 확인</h2>
    <p class="걸림">1분</p>

    <p>브라우저 주소창에 이것을 칩니다.</p>
    <div class="검은창"><span class="밝게">https://github.com/onekey01/tongdol-note/releases/latest/download/version.json</span></div>

    <div class="표감"><table>
      <thead><tr><th style="width:10rem">보이는 것</th><th>뜻</th></tr></thead>
      <tbody>
        <tr><td><b>글자 덩어리</b><br><span class="작게">{"version":"1.22.36",…</span></td>
            <td>✅ 됐습니다. 기관은 다음에 켤 때 알아서 봅니다</td></tr>
        <tr><td><b>404</b></td>
            <td>❌ Publish 를 안 눌렀거나, 태그가 틀렸거나, 파일을 안 올렸습니다</td></tr>
      </tbody>
    </table></div>

    <p class="작게">더 확실히 보시려면 개발 PC 에서 프로그램을 켜고
       <b>설정 → 이 프로그램 → 업데이트 안내 → <span class="누름">새 버전이 있는지 지금 확인</span></b>.
       <span class="뜬말">지금이 가장 새 버전입니다</span> 가 뜨면(개발 PC 는 이미 그 버전이니)
       읽는 길이 살아 있는 것입니다.</p>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<h2 style="margin-top:3.4rem">다음 버전부터는 이것만</h2>
<div class="차례">
  <ol>
    <li>이번에 바뀐 것.txt 적기<em>3분</em></li>
    <li>통돌Note 만들기.bat — 앞 두 자리 올리고, 둘째 물음은 대개 엔터<em>10~15분</em></li>
    <li>GitHub Release 에 세 파일 (태그 = v + 세 자리)<em>5분</em></li>
    <li>주소 쳐서 version.json 이 보이는지<em>1분</em></li>
  </ol>
</div>
<p>기관은 <b>다음에 프로그램을 켤 때</b> 띠가 뜨고, 관리자가
   <span class="누름">지금 업데이트</span> 를 한 번 누르면 끝납니다.
   압축을 풀거나 파일을 옮길 일이 없습니다. <b>연락 안 하셔도 됩니다.</b></p>

<h2>기관 쪽에서 벌어지는 일</h2>
<div class="표감"><table>
  <thead><tr><th style="width:13rem">언제</th><th>무엇이</th></tr></thead>
  <tbody>
    <tr><td>켤 때 (하루 한 번)</td><td>조용히 version.json 을 읽어 봅니다</td></tr>
    <tr><td>새 버전이면</td><td><b>뒤에서</b> zip 을 받습니다. 관리자는 하던 일을 계속합니다</td></tr>
    <tr><td>다 받으면</td><td>화면 위에 띠 — <span class="뜬말">새 버전의 업데이트가 준비됐습니다</span></td></tr>
    <tr><td><span class="누름">지금 업데이트</span> 를 누르면</td>
        <td>프로그램이 꺼지고 → 검은 창 8초 → <b>새 버전으로 다시 켜집니다</b></td></tr>
  </tbody>
</table></div>
<ul>
  <li><b>자료는 안 건드립니다</b> — <span class="길">data\</span> 폴더는 손도 안 댑니다</li>
  <li><b>옛 버전은 <span class="길">이전버전\</span> 에 남습니다</b> — 이상하면 돌아갈 자리</li>
  <li><b>인터넷이 없어도 평소대로 켜집니다</b> — 3초 안에 답 없으면 조용히 넘어갑니다</li>
  <li>관리자가 아닌 사람 화면에는 <b>띠가 안 뜹니다</b></li>
  <li><b>묻지 않고 저절로 바꾸지는 않습니다</b> — 청구서를 만드는 프로그램이라,
      밤사이 셈이 바뀌면 어제와 오늘 금액이 다른데 아무도 이유를 모릅니다</li>
</ul>

<h2>막힐 때</h2>
<div class="표감"><table>
  <thead><tr><th style="width:20rem">뜨는 말 · 증상</th><th>무엇이 잘못됐나</th></tr></thead>
  <tbody>
    <tr><td>만들기 끝에 <span class="뜬말">서명 열쇠가 아직 없습니다</span></td>
        <td><b>1단계</b>를 안 하셨습니다</td></tr>
    <tr><td>만들기 끝에 <span class="뜬말">이번에 바뀐 것.txt 가 비어 있습니다</span></td>
        <td><b>3단계</b> — 한 줄이라도 적어 주세요</td></tr>
    <tr><td>「올릴것」 폴더가 안 생김</td>
        <td>1단계(열쇠) 또는 3단계(바뀐 것) 둘 중 하나가 빠졌습니다</td></tr>
    <tr><td>version.json 주소가 <b>404</b></td>
        <td>Release 를 <b>Publish</b> 안 했거나, 태그가 틀렸거나, 파일을 안 올렸습니다</td></tr>
    <tr><td>기관 화면에 띠가 안 뜸</td>
        <td>버전 번호를 안 올렸을 수 있습니다 (같은 번호면 안 뜹니다).
            또는 그 기관 프로그램에 <b>열쇠가 없는 옛 버전</b>입니다 — <b>5단계</b></td></tr>
    <tr><td>기관이 <span class="뜬말">받는 중</span> 에서 안 끝남</td>
        <td>태그가 <span class="길">v1.22.36</span> 이 아닐 가능성이 큽니다</td></tr>
    <tr><td>검은 창에 <span class="뜬말">버전정보의 서명이 맞지 않습니다</span></td>
        <td>version.json 만 바꾸고 .sig 를 안 올렸습니다 — <b>셋을 늘 같이</b></td></tr>
  </tbody>
</table></div>

<div class="못박기" style="margin-top:2.6rem">
  GitHub 을 안 쓰셔도 됩니다<br>
  <span style="font-weight:400; font-size:.94rem; line-height:1.8">
    zip 하나를 메일이나 USB 로 건네고 기관이 <b>통돌Note 설치.bat</b> 를 다시 누르는 길은
    <b>늘 살아 있습니다.</b> 서명 열쇠가 없어도 zip 은 언제나 만들어집니다.<br>
    GitHub 은 <b>편해지는 길</b>이지 없으면 안 되는 것이 아닙니다.
  </span>
</div>
"""

발 = """<p><b>이 종이는 무무 님이 보시는 것입니다.</b> 기관에 나가지 않습니다.</p>
<p>같은 내용을 짧게 적어 둔 것 — <b>업데이트 올리는 법.md</b><br>
   배포본과 설치 파일이 무엇이 다른지 — <b>배포하기.md</b></p>
<p class="작게">통돌 Note · {버전} · 2026-09-11</p>"""

짓기(
    파일="새 버전 내보내기.html",
    제목="새 버전 내보내기",
    탭이름="통돌 Note — 새 버전 내보내기",
    한줄="처음 한 번 두 가지, 그 다음부터는 매번 네 가지. 그대로 따라 하시면 됩니다.",
    꼬리=[("이번 버전", "1.22.36"), ("기관에 깔린 것", "설정 → 이 프로그램 에서 확인"), ("걸리는 시간", "처음 40분 · 다음부터 20분")],
    몸=몸,
    발=발.replace("{버전}", "1.22.36"),
)
