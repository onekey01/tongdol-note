import { useEffect, useState } from 'react'

/**
 * 아주 작은 길잡이(라우터)입니다.
 *
 * 왜 직접 만들었나:
 * 화면이 다섯 개뿐인데 라우터 꾸러미를 하나 더 얹으면
 * 설치할 것도, 나중에 버전을 맞출 것도 늘어납니다.
 * 필요한 건 "지금 주소가 뭔지" 와 "새로고침 없이 주소 바꾸기" 둘뿐입니다.
 */

export function navigate(to: string) {
  if (location.pathname === to) return
  history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): string {
  const [path, setPath] = useState(() => location.pathname)
  useEffect(() => {
    const onPop = () => setPath(location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}

/** <a> 를 눌러도 새로고침 없이 넘어가게 하는 도우미. */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigate(to)
    },
  }
}
