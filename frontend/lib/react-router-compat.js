'use client'

import { useEffect } from 'react'
import NextLink from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function normalizeTo(to) {
  if (typeof to === 'string') return to
  if (!to) return '/'

  const pathname = to.pathname || '/'
  const search = to.search || ''
  const hash = to.hash || ''
  return `${pathname}${search}${hash}`
}

export function useNavigate() {
  const router = useRouter()

  return (to, options = {}) => {
    const href = normalizeTo(to)

    if (options?.replace) {
      router.replace(href)
      return
    }

    router.push(href)
  }
}

export function useLocation() {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''

  return {
    pathname,
    search,
    hash: '',
    state: null,
    key: pathname,
  }
}

export function Navigate({ to, replace = false }) {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, replace, to])

  return null
}

export function Link({ to, children, ...props }) {
  return (
    <NextLink href={normalizeTo(to)} {...props}>
      {children}
    </NextLink>
  )
}

export function NavLink({ to, className, children, ...props }) {
  const pathname = usePathname() || '/'
  const href = normalizeTo(to)
  const targetPath = href.split('?')[0]
  const isActive = pathname === targetPath || pathname.startsWith(`${targetPath}/`)

  const resolvedClassName = typeof className === 'function'
    ? className({ isActive, isPending: false })
    : className

  return (
    <NextLink href={href} className={resolvedClassName} {...props}>
      {typeof children === 'function' ? children({ isActive, isPending: false }) : children}
    </NextLink>
  )
}

export function BrowserRouter({ children }) {
  return children
}

export function Routes({ children }) {
  return children
}

export function Route() {
  return null
}
