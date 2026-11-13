# Autenticación y permisos de la API

La API verifica primero el JWT y después los permisos de la ruta. Las rutas
protegidas sin `@Roles()` o con una lista vacía devuelven 403 para usuarios
autenticados. Sin un token válido, la respuesta es 401. `@Public()` permite
omitir esos dos controles únicamente en las rutas marcadas explícitamente.

`POST /auth/login` es público. `/` y `/health` exigen un JWT válido y permiten
ADMIN, OPERADOR y LECTOR. Los permisos actuales de los catálogos se conservan:
los tres roles consultan y solamente ADMIN crea, edita o cambia estados.

El token se firma con HS256, vence en una hora y se verifica aceptando
exclusivamente HS256. Se conserva `JWT_SECRET` de la configuración existente.
En cada petición protegida se comprueba en la base que el usuario exista y siga
activo; se utiliza su rol vigente, sin confiar en el rol anterior del token.

## Límite de solicitudes de login

Se utiliza `@nestjs/throttler` 6.7.1, compatible con NestJS 11 según sus
[dependencias oficiales](https://github.com/nestjs/throttler/blob/v6.7.1/package.json).
La configuración sigue la [documentación de NestJS](https://docs.nestjs.com/security/rate-limiting).

- Solamente `POST /auth/login` usa `ThrottlerGuard`.
- Se permiten hasta cinco solicitudes por IP en 60 segundos. Se cuentan tanto
  los logins exitosos como los fallidos y las solicitudes con datos inválidos.
- La solicitud que supera el límite devuelve 429, con la cabecera `Retry-After`.
  El bloqueo de esa IP dura 60 segundos desde que se supera el límite.
- El bloqueo del login no limita las consultas u operaciones de los demás endpoints.
- Se usa el almacenamiento en memoria de la biblioteca. El contador se reinicia
  al reiniciar el proceso y no se comparte entre varias instancias.
- El identificador se obtiene de `req.ip`, con la normalización estándar de la
  biblioteca. Personas que comparten una IP comparten el límite; en IPv6 la
  biblioteca agrupa por defecto las direcciones de una misma subred /64.
- La aplicación no habilita `trust proxy`. Si se despliega detrás de un proxy,
  debe configurarse expresamente qué proxies son confiables para reconocer la IP
  del cliente. No se toma `X-Forwarded-For` directamente como una IP confiable.

Esta protección **no implementa por completo RF-AUT-04**. La ERS 1.4 exige el
bloqueo temporal ante intentos reiterados de acceso fallido. Sigue pendiente el
control por cuenta, independiente de la IP, y el seguimiento de sus fallos.
No se agregan registros de contraseñas ni de tokens para aplicar este límite.

## Comprobación manual en Postman

1. Hacer login sin Bearer: debe responder 200 con credenciales correctas.
2. Enviar seis solicitudes de login desde la misma IP en menos de un minuto:
   la sexta debe devolver 429. Respetar `Retry-After` antes de reintentar.
3. Con un JWT válido ya obtenido, consultar cuentas tras recibir 429 en login:
   la consulta debe seguir funcionando.
4. Consultar `/` y `/health`: sin token deben responder 401; con un usuario
   activo de cualquiera de los tres roles deben responder 200.
5. Verificar que OPERADOR y LECTOR continúen recibiendo 403 al intentar escribir
   en los catálogos, y que ADMIN conserve esos permisos.

Las pruebas E2E añaden rutas de prueba sin `@Roles()` y con `@Roles()` vacío
para verificar la respuesta 403. Esas rutas no se registran en la API real.
