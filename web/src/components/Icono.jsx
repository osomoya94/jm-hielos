export default function Icono({ nombre, ...props }) {
  const trazos = {
    insumos: (
      <>
        <path d="M4 8h16v13H4ZM3 3h18v5H3ZM9 12h6" />
      </>
    ),
    produccion: (
      <>
        <path d="M3 21V10l6 3V8l6 3V3h4v18ZM7 17h1m3 0h1m3 0h1" />
      </>
    ),
    reposiciones: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 5M4 13a8 8 0 0 0 14 5" />
      </>
    ),
    deudas: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </>
    ),
    inicio: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    productos: (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8Zm0 10 9-5M3 8l9 5v9M7 5.8l9 5" />
      </>
    ),
    clientes: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
    proveedores: (
      <>
        <path d="M3 7h11v11H3ZM14 11h4l3 4v3h-7" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    cerrar: (
      <>
        <path d="m6 6 12 12M6 18 18 6" />
      </>
    ),
    buscar: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    editar: (
      <>
        <path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15Z" />
      </>
    ),
    flecha: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    candado: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    actualizar: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 5M4 13a8 8 0 0 0 14 5" />
      </>
    ),
    flujo: (
      <>
        <path d="M3 3v18h18" />
        <path d="m6 14 5-5 4 3 6-8" />
      </>
    ),
    cuentas: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 9h18M16 14h3" />
      </>
    ),
    categorias: (
      <>
        <path d="M3 3h8l10 10-8 8L3 11Z" />
        <circle cx="7" cy="7" r="1" />
      </>
    ),
    nuevo: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    salir: (
      <>
        <path d="M9 5H4v14h5M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    ingreso: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    egreso: (
      <>
        <path d="m7 7 10 10M7 17h10V7" />
      </>
    )
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {trazos[nombre] || trazos.flujo}
    </svg>
  )
}
