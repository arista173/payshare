import type { InputHTMLAttributes } from 'react'

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>

type TextFieldProps = BaseInputProps & {
  id: string
  label: string
  error?: string
}

export function TextField({ id, label, error, ...inputProps }: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={[
          'rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition-colors',
          'focus:ring-2 focus:ring-slate-400',
          error
            ? 'border-red-400 focus:ring-red-300'
            : 'border-slate-300 focus:border-slate-400',
        ].join(' ')}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
