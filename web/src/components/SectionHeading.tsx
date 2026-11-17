import './SectionHeading.css'

interface SectionHeadingProps {
  /** 작은 라틴/영문 라벨 (예: "INVITATION") */
  eyebrow?: string
  title: string
  subtitle?: string
}

export function SectionHeading({ eyebrow, title, subtitle }: SectionHeadingProps) {
  return (
    <header className="section-heading">
      {eyebrow && <p className="section-heading__eyebrow">{eyebrow}</p>}
      <h2 className="section-heading__title">{title}</h2>
      <span className="section-heading__rule" aria-hidden="true" />
      {subtitle && <p className="section-heading__subtitle">{subtitle}</p>}
    </header>
  )
}
