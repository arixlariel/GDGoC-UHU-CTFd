# Cyber Scoring & Hints Plugin (CTFd 3.8+)

Plugin de servidor para aplicar de forma persistente en base de datos (sin resetearse al cerrar sesión):

1. **Intentos ilimitados** (`max_attempts = 0`, ya configurado en los 63 retos de `188.245.96.96`).
2. **Penalización por fallo (-5 pts/fallo):** cada envío incorrecto en un reto resta **5 puntos** del máximo obtenible de **ese reto** al resolverlo (nunca resta de puntos que ya tuvieras de otros retos y nunca baja de 0 en el reto).
3. **Hints por porcentaje (múltiplos de 5 %):** desbloquear una pista no resta puntos de tu marcador actual; aplica el descuento en porcentaje (múltiplo de 5 %) sobre el valor de ese reto al resolverlo.

## Instalación en el servidor CTFd (`188.245.96.96`)

1. Copia la carpeta `cyber_percent_hints/` dentro de `CTFd/plugins/` en el servidor (o móntala en `docker-compose.yml` en `/opt/CTFd/CTFd/plugins/cyber_percent_hints`).
2. Reinicia el servicio/contenedor de CTFd para activar el plugin.
3. Configura `cost` en cada pista con el porcentaje deseado en múltiplos de 5 (`5`, `10`, `15`, `20`...).
