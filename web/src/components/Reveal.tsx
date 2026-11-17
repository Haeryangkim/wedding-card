import type { ReactNode } from 'react'
import { useReveal } from '../lib/useReveal'
import './Reveal.css'

interface RevealProps {
  children: ReactNode
  className?: string
  /** 나타나는 지연(ms) */
  delay?: number
}

/** 스크롤 시 은은하게 떠오르는(fade-up) 래퍼. */
export function Reveal({ children, className = '', delay }: RevealProps) {
  const [ref, revealed] = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal${revealed ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
