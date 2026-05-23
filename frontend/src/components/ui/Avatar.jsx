const COMPANY_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-cyan-500',
  'bg-violet-500', 'bg-orange-500', 'bg-rose-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-fuchsia-500',
]

function hashCompanyName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % COMPANY_COLORS.length
}

export function Avatar({ name, size = 'md' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const colorClass = COMPANY_COLORS[hashCompanyName(name)]

  const sizeClasses = {
    sm:  'w-7 h-7 text-xs',
    md:  'w-9 h-9 text-sm',
    lg:  'w-12 h-12 text-base',
    xl:  'w-16 h-16 text-xl',
  }

  return (
    <div
      className={`${colorClass} ${sizeClasses[size]} rounded-lg flex items-center justify-center font-bold text-white font-mono flex-shrink-0`}
      aria-label={`${name} avatar`}
    >
      {initials}
    </div>
  )
}
