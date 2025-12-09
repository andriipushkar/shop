import { ComponentType } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  trend?: {
    value: string | number
    label: string
  }
  variant?: 'default' | 'warning' | 'danger'
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: {
      bg: 'bg-primary-50',
      icon: 'text-primary-600',
    },
    warning: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
    },
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium">{trend.value}</span> {trend.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${styles.bg}`}>
          <Icon className={`w-6 h-6 ${styles.icon}`} />
        </div>
      </div>
    </div>
  )
}
