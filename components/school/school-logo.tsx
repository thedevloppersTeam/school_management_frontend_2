import { cn } from "@/lib/utils"

interface SchoolLogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SchoolLogo({ className, showText = true, size = 'md' }: SchoolLogoProps) {
  const logoSizes = {
    sm: { box: 40, text: 16, name: 16, subtitle: 10 },
    md: { box: 56, text: 22, name: 20, subtitle: 12 },
    lg: { box: 56, text: 22, name: 20, subtitle: 12 }
  }

  const sizes = logoSizes[size]

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo carré avec "SL" */}
      <div
        style={{
          width: `${sizes.box}px`,
          height: `${sizes.box}px`,
          backgroundColor: '#2A3740',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(42, 55, 64, 0.15)',
          flexShrink: 0
        }}
      >
        <span
          className="font-serif font-bold"
          style={{
            color: '#C3B594',
            fontSize: `${sizes.text}px`,
            lineHeight: 1
          }}
        >
          SL
        </span>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className="font-serif font-bold leading-tight"
            style={{
              color: '#2A3740',
              fontSize: '20px',
              letterSpacing: '-0.02em'
            }}
          >
            CPMSL
          </span>
          <span
            className="font-sans leading-tight text-muted-foreground"
            style={{
              fontSize: '12px',
              fontWeight: 400
            }}
          >
            Cours Privé Mixte Saint Léonard
          </span>
        </div>
      )}
    </div>
  )
}