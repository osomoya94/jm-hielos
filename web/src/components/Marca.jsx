export default function Marca({ compacta = false }) {
  return (
    <span className={'marca ' + (compacta ? 'marca-compacta' : '')}>
      <img src="/logo-jm.jpeg.jpeg" alt="Logo JM Hielos" width="160" height="87" />
      <span aria-hidden="true">
        JM Hielos<small>Administración</small>
      </span>
    </span>
  )
}
