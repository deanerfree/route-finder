import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'

interface CollapsiblePanelProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  headerExtra?: React.ReactNode
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`panel-chevron ${open ? 'open' : ''}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
  className,
  headerExtra
}: CollapsiblePanelProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <section className={className}>
          <DisclosureButton className="panel-header">
            <h2>{title}</h2>
            <div className="panel-header-right">
              {headerExtra}
              <ChevronIcon open={open} />
            </div>
          </DisclosureButton>
          <DisclosurePanel>{children}</DisclosurePanel>
        </section>
      )}
    </Disclosure>
  )
}
