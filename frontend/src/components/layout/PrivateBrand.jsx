import BrandLogo from '../public/BrandLogo';
import { Link } from 'react-router-dom';
export default function PrivateBrand({ admin = false }) {
  return <Link className="private-brand" to={admin ? '/admin' : '/dashboard'} aria-label="ContadorGanadero, inicio"><BrandLogo size={38} /><span className="private-brand-text"><strong>ContadorGanadero</strong><small>{admin ? 'Administración' : 'Mi finca'}</small></span></Link>;
}
