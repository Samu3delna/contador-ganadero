import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground backdrop-blur-md',
  {
    variants: {
      variant: {
        default: 'bg-slate-900/80 text-slate-100 border-slate-800',
        destructive:
          'border-red-500/30 bg-red-950/30 text-red-300 [&>svg]:text-red-400',
        success:
          'border-emerald-500/30 bg-emerald-950/30 text-emerald-300 [&>svg]:text-emerald-400',
        warning:
          'border-amber-500/30 bg-amber-950/30 text-amber-300 [&>svg]:text-amber-400',
        info:
          'border-sky-500/30 bg-sky-950/30 text-sky-300 [&>svg]:text-sky-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-semibold leading-none tracking-tight text-white font-heading', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-slate-300 [&_p]:leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
