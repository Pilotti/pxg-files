import { useLayoutEffect, useRef } from "react"

export default function useStableScroll() {
  const pendingScrollTopRef = useRef(null)

  function preserveScroll() {
    pendingScrollTopRef.current = window.scrollY || document.documentElement.scrollTop || 0
  }

  useLayoutEffect(() => {
    if (pendingScrollTopRef.current == null) return

    const nextTop = pendingScrollTopRef.current
    pendingScrollTopRef.current = null
    window.scrollTo(0, nextTop)
  })

  return preserveScroll
}
