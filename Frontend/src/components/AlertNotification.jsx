import { useState, useEffect } from 'react'

const AlertNotification = ({ alert, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const alertConfig = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: '✓'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: '✕'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: '⚠'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'ℹ'
    }
  }

  const config = alertConfig[alert.type] || alertConfig.info

  return (
    <div className={`${config.bg} border ${config.border} ${config.text} px-4 py-3 rounded-lg flex items-center gap-3`}>
      <span className="text-lg">{config.icon}</span>
      <div className="flex-1">
        {alert.title && <p className="font-medium">{alert.title}</p>}
        <p className="text-sm">{alert.message}</p>
      </div>
      <button onClick={onClose} className="text-lg font-bold">×</button>
    </div>
  )
}

export default AlertNotification