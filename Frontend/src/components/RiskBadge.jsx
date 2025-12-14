const RiskBadge = ({ level, className = '' }) => {
  const riskConfig = {
    low: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      dot: 'bg-green-500',
      label: 'Low Risk'
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      dot: 'bg-yellow-500',
      label: 'Medium Risk'
    },
    high: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      dot: 'bg-red-500',
      label: 'High Risk'
    }
  }

  const config = riskConfig[level?.toLowerCase()] || riskConfig.low

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.text} text-sm font-medium ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
      {config.label}
    </div>
  )
}

export default RiskBadge