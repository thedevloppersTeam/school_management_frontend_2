import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconBgColor?: string // Background color for icon
  iconColor?: string // Icon color
  subtitle?: string // Optional subtitle below the value
}

export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  iconBgColor = "#F0F4F7",
  iconColor = "#5A7085",
  subtitle
}: StatCardProps) {
  return (
    <Card 
      className="bg-white border border-[#E8E6E3] rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: iconBgColor }}
          >
            <Icon className="h-6 w-6" style={{ color: iconColor }} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p 
                className="font-serif" 
                style={{ 
                  fontSize: "28px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.025em",
                  color: "#2A3740" 
                }}
              >
                {value}
              </p>
              {subtitle && (
                <p 
                  className="font-sans" 
                  style={{ 
                    fontSize: "12px",
                    fontWeight: 400,
                    lineHeight: 1.5,
                    color: "#A8A39C" 
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <p 
              className="font-sans mt-1" 
              style={{ 
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: "0.02em",
                color: "#78756F" 
              }}
            >
              {label}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}