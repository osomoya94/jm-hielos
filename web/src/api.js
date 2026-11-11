import axios from 'axios'

const cliente = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

export async function consultarApi(ruta, token, opciones = {}) {
  try {
    const respuesta = await cliente.request({
      url: ruta,
      ...opciones,
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    })
    return respuesta.data
  } catch (error) {
    const mensaje = error.response?.data?.message
    const texto = Array.isArray(mensaje) ? mensaje.join('. ') : mensaje
    const fallo = new Error(texto || 'No se pudo conectar con la API. Verificá la conexión y volvé a intentar.')
    fallo.status = error.response?.status
    throw fallo
  }
}
