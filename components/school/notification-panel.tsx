import { AlertTriangleIcon, XCircleIcon, CheckCircle2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: 'warning' | 'error' | 'success'
  title: string
  subtitle: string
  timestamp: string
  isRead: boolean
}

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAllRead?: () => void
  onNotificationClick?: (id: string) => void
}

export function NotificationPanel({ 
  notifications, 
  onMarkAllRead,
  onNotificationClick 
}: NotificationPanelProps) {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangleIcon className="h-5 w-5" style={{ color: "#D97706" }} />
      case 'error':
        return <XCircleIcon className="h-5 w-5" style={{ color: "#C43C3C" }} />
      case 'success':
        return <CheckCircle2Icon className="h-5 w-5" style={{ color: "#2D7D46" }} />
    }
  }

  // Group notifications by date
  const today = notifications.filter(n => n.timestamp.includes('il y a'))
  const yesterday = notifications.filter(n => n.timestamp.includes('hier'))

  return (
    <div 
      className="absolute right-0 top-full mt-2 rounded-lg border shadow-lg overflow-hidden z-50"
      style={{ 
        width: "360px",
        backgroundColor: "white",
        borderColor: "#E8E6E3"
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "#E8E6E3" }}
      >
        <h3 
          className="font-sans"
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#2A3740"
          }}
        >
          Notifications
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 hover:bg-transparent"
          onClick={onMarkAllRead}
        >
          <span
            className="font-sans"
            style={{
              fontSize: "13px",
              fontWeight: 400,
              color: "#5A7085"
            }}
          >
            Tout marquer lu
          </span>
        </Button>
      </div>

      {/* Notifications list */}
      <div className="max-h-[480px] overflow-y-auto">
        {/* Today section */}
        {today.length > 0 && (
          <div>
            <div 
              className="px-4 py-2"
              style={{ backgroundColor: "#FAFAF8" }}
            >
              <span
                className="font-sans"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#5C5955",
                  letterSpacing: "0.03em"
                }}
              >
                Aujourd'hui
              </span>
            </div>
            {today.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  !notification.isRead && "border-l-2"
                )}
                style={{
                  borderBottomColor: "#E8E6E3",
                  borderLeftColor: !notification.isRead ? "#2B6CB0" : "transparent",
                  backgroundColor: !notification.isRead ? "#F0F4F7" : "transparent"
                }}
                onClick={() => onNotificationClick?.(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className="font-sans"
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#2A3740",
                          lineHeight: 1.4
                        }}
                      >
                        {notification.title}
                      </h4>
                      <span
                        className="font-sans flex-shrink-0"
                        style={{
                          fontSize: "12px",
                          fontWeight: 400,
                          color: "#5C5955"
                        }}
                      >
                        {notification.timestamp}
                      </span>
                    </div>
                    <p
                      className="font-sans mt-0.5"
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "#5C5955",
                        lineHeight: 1.4
                      }}
                    >
                      {notification.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Yesterday section */}
        {yesterday.length > 0 && (
          <div>
            <div 
              className="px-4 py-2"
              style={{ backgroundColor: "#FAFAF8" }}
            >
              <span
                className="font-sans"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#5C5955",
                  letterSpacing: "0.03em"
                }}
              >
                Hier
              </span>
            </div>
            {yesterday.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  !notification.isRead && "border-l-2"
                )}
                style={{
                  borderBottomColor: "#E8E6E3",
                  borderLeftColor: !notification.isRead ? "#2B6CB0" : "transparent",
                  backgroundColor: !notification.isRead ? "#F0F4F7" : "transparent"
                }}
                onClick={() => onNotificationClick?.(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className="font-sans"
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#2A3740",
                          lineHeight: 1.4
                        }}
                      >
                        {notification.title}
                      </h4>
                      <span
                        className="font-sans flex-shrink-0"
                        style={{
                          fontSize: "12px",
                          fontWeight: 400,
                          color: "#5C5955"
                        }}
                      >
                        {notification.timestamp}
                      </span>
                    </div>
                    <p
                      className="font-sans mt-0.5"
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "#5C5955",
                        lineHeight: 1.4
                      }}
                    >
                      {notification.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p
              className="font-sans"
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: "#5C5955"
              }}
            >
              Aucune notification
            </p>
          </div>
        )}
      </div>
    </div>
  )
}