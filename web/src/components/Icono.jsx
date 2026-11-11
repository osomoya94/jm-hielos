export default function Icono({ nombre, ...props }) {
  const trazos = {
    flujo: <><path d="M3 3v18h18" /><path d="m6 14 5-5 4 3 6-8" /></>,
    cuentas: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h3" /></>,
    categorias: <><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7" cy="7" r="1" /></>,
    nuevo: <><path d="M12 5v14M5 12h14" /></>,
    salir: <><path d="M9 5H4v14h5M9 12h12m-4-4 4 4-4 4" /></>,
    ingreso: <><path d="M7 17 17 7M7 7h10v10" /></>,
    egreso: <><path d="m7 7 10 10M7 17h10V7" /></>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{trazos[nombre] || trazos.flujo}</svg>
}
