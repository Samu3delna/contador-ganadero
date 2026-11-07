import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/theme';
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = `Activar modo ${theme === 'dark' ? 'claro' : 'oscuro'}`;
  return <button type="button" className="theme-toggle" onClick={toggleTheme} title={label} aria-label={label}>
    {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    <span>{theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
  </button>;
}
