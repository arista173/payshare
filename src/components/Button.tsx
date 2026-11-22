import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: 'primary' | 'ghost'
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        fullWidth ? 'w-full' : '',
        variant === 'primary'
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'bg-transparent text-slate-600 hover:bg-slate-100',
      ].join(' ')}
      {...buttonProps}
    />
  )
}
