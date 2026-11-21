# Cyber Percent Hints Plugin (CTFd 3.8+)

Plugin de servidor para cambiar el comportamiento nativo de pistas (hints) de CTFd:

- **Sin penalización previa**: al desbloquear una pista (`hint`) no se descuenta nada de los puntos que ya tiene el usuario.
- **Descuento porcentual redondeado a múltiplos de 5 %**: el porcentaje de cada pista desbloqueada se aplica **únicamente sobre la puntuación de ese reto** en el momento de resolverlo.

## Instalación en el servidor CTFd (`188.245.96.96`)

1. Copia la carpeta `cyber_percent_hints/` dentro de `CTFd/plugins/` en el servidor (o móntala en `docker-compose.yml` en `/opt/CTFd/CTFd/plugins/cyber_percent_hints`).
2. Reinicia el contenedor/servicio de CTFd para que cargue el plugin.
3. Configura el campo `cost` de cada pista con el porcentaje deseado en múltiplos de 5 (p. ej. `10`, `15`, `25`).
