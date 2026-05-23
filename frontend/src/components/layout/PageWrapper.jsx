import { useEffect, useRef } from 'react'

export function PageWrapper({ children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.classList.add('page-enter')
    }
  }, [])

  return (
    <main
      ref={ref}
      className={`min-h-[calc(100vh-3.5rem)] px-6 py-6 ${className}`}
    >
      {children}
    </main>
  )
}
