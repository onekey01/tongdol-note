export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'theme'

/** 저장된 선택을 읽습니다. 정한 적이 없으면 '밝게'. */
export function getThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(KEY)
  return v === 'system' || v === 'dark' ? v : 'light'
}

/** 선택을 저장하고 화면에 바로 반영합니다. */
export function setThemeChoice(choice: ThemeChoice) {
  localStorage.setItem(KEY, choice)
  applyTheme(choice)
}

/** 선택을 실제 색으로 바꿔 붙입니다. */
export function applyTheme(choice: ThemeChoice = getThemeChoice()) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

/**
 * '시스템 따름'을 골랐을 때, 윈도우 설정이 바뀌면 따라가게 합니다.
 * 정리 함수를 돌려주므로 useEffect 에서 그대로 쓸 수 있습니다.
 */
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getThemeChoice() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
