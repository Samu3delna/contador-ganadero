import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names using clsx and resolves Tailwind CSS class conflicts using tailwind-merge.
 * Standard utility function for shadcn/ui.
 * 
 * @param  {...any} inputs 
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
