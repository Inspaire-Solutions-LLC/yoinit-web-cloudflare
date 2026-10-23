# Borrador: App Privacy (Apple) y Data safety (Google Play)

Borrador derivado de lo que hace la app a 2026-10-23 (`yoinit-app/lib`, `pubspec.yaml`, `Info.plist`, `AndroidManifest.xml`). Sin revisión legal. Debe cuadrar con `/privacidad`.

Hechos de base: sin SDK de publicidad ni de analítica de producto (solo Sentry para errores, con `sendDefaultPii=false` y replay con texto/imágenes enmascarados). Sin ATT ni IDFA. Sin acceso a contactos. Datos cifrados en tránsito (HTTPS a Supabase). Eliminación de cuenta en https://yoinit.app/eliminar-cuenta/. Política: https://yoinit.app/privacidad/. Términos: https://yoinit.app/terminos/.

## Apple: App Privacy (nutrition labels)

Tracking (usar datos para seguir al usuario entre apps/webs de terceros o compartirlos con data brokers): **No**. Ningún dato se marca "usado para rastreo".

| Categoría Apple | Dato | ¿Se recoge? | ¿Vinculado a identidad? | Rastreo | Finalidad |
|---|---|---|---|---|---|
| Contact Info | Name | Sí | Sí | No | App Functionality |
| Contact Info | Email Address | Sí (también el correo de reenvío privado de Apple) | Sí | No | App Functionality (cuenta, avisos), Customer Support |
| Contact Info | Phone Number | Sí (campo de perfil y Pago Móvil) | Sí | No | App Functionality |
| Contact Info | Physical address / Other | No | | | |
| Health & Fitness | Fitness | No (el nivel de pádel y los resultados son datos de juego, no de salud) | | | Ver duda 2 |
| Financial Info | Other Financial Info (banco, cédula/RIF, referencia de Pago Móvil) | Solo si se activan reservas/pagos (`CLUB_FLOWS_ENABLED`) | Sí | No | App Functionality. Nunca números de tarjeta |
| Purchases | Purchase History | Solo con pagos activos (historial de reservas/pagos) | Sí | No | App Functionality |
| Location | Precise Location | Sí, solo en uso (When In Use); se envía al servidor para ordenar por distancia y buscar lugares con Google Places | Ver duda 1 | No | App Functionality |
| Location | Coarse Location | Cubierto por la anterior | | | |
| Contacts | Contacts | No | | | |
| User Content | Photos or Videos | Sí (fotos enviadas al chat de grupo; foto/avatar de perfil si existe) | Sí | No | App Functionality |
| User Content | Other User Content | Sí (mensajes de chat, reportes con su detalle y copia del mensaje reportado, consultas de soporte) | Sí | No | App Functionality; seguridad/moderación |
| Browsing History / Search History | No se recoge historial de navegación; la búsqueda de lugares va a Google Places pero no se guarda | No | | | Ver duda 3 |
| Identifiers | User ID | Sí (id de cuenta Supabase) | Sí | No | App Functionality |
| Identifiers | Device ID | Sí (identificador de instalación y token de push FCM/APNs) | Sí | No | App Functionality (notificaciones) |
| Usage Data | Product Interaction / Advertising Data | No (sin analítica de producto) | | | |
| Diagnostics | Crash Data, Performance Data, Other Diagnostic Data | Sí (Sentry) | Ver duda 4 | No | App Functionality (diagnóstico). No Analytics |
| Sensitive Info | | No | | | |

Notas de cuestionario:
- La cámara se usa para foto de chat y QR de partida; las imágenes no se almacenan salvo la foto que el usuario envía al chat.
- Sign in with Apple y Google: el id y el email recibidos se reflejan como Email/Name/User ID arriba.

## Google Play: Data safety

- ¿Recoge o comparte datos? **Sí recoge; no vende ni comparte con terceros para publicidad.** Los proveedores que actúan como encargados (Supabase, Firebase Cloud Messaging, Sentry, Google Places, Resend, BNC) cuentan como "service providers" y, según la guía de Play, no se declaran como "compartir".
- ¿Cifrado en tránsito? **Sí.**
- ¿Puede el usuario pedir que se eliminen sus datos? **Sí**, URL: https://yoinit.app/eliminar-cuenta/ (y en la app).

| Categoría Play | Dato | Recogido | Compartido | Opcional | Finalidad |
|---|---|---|---|---|---|
| Personal info | Name | Sí | No | No | App functionality, Account management |
| Personal info | Email address | Sí | No | No | App functionality, Account management, Communications |
| Personal info | User IDs | Sí | No | No | App functionality, Account management |
| Personal info | Phone number | Sí | No | Sí | App functionality |
| Financial info | Other financial info | Solo si hay pagos activos | No | Sí | App functionality |
| Location | Approximate location | Sí | No | Sí (permiso opcional) | App functionality |
| Location | Precise location | Sí (se pide FINE y COARSE) | No | Sí | App functionality |
| Photos and videos | Photos | Sí (chat de grupo, avatar) | No | Sí | App functionality |
| Messages | Other in-app messages | Sí (chat de grupos) | No | No | App functionality |
| App activity | Other user-generated content | Sí (reportes, notas) | No | Sí | App functionality, Fraud prevention/security |
| App info and performance | Crash logs, Diagnostics | Sí (Sentry) | No | No | App functionality (diagnóstico), no Analytics |
| Device or other IDs | Device or other IDs | Sí (token FCM) | No | Sí (permiso de notificaciones) | App functionality |

Permisos Android declarados: ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION (más los de red/cámara/notificaciones que añaden los plugins). Revisar el manifiesto fusionado del build de release antes de enviar.

## Dudas abiertas

1. Ubicación: la app envía lat/lng al servidor (RPC de cercanía) y a Google Places. Conviene confirmar en backend si se persiste (logs); si no se guarda, Apple permite no declararla "vinculada" solo si no se asocia a la cuenta; por prudencia, declararla vinculada.
2. Nivel/resultados de pádel: no es salud, pero Apple a veces lo ve como Fitness. Mantener "No" salvo que el revisor pida lo contrario.
3. Google Places: el texto buscado sale a Google. Confirmar si pasa por edge function (Google ve la IP del servidor) o desde el dispositivo, y si debe constar como "Search History".
4. Sentry: con `sendDefaultPii=false` no se envía IP ni usuario, pero los eventos pueden llevar id de dispositivo. Si se llama `Sentry.setUser`, pasa a "vinculado". Revisar antes de enviar.
5. Pagos/reservas y créditos: están apagados por defecto en la app (`clubFlowsEnabled=false`). Si el build de revisión no los incluye, no declarar Financial Info/Purchases; si se activan después, actualizar la ficha antes.
6. Correos de novedades y push de marketing: la privacidad los condiciona a consentimiento; no se verificó que la app tenga un interruptor. Si no existen, quitarlos del texto.
7. Mantener alineado: cualquier cambio aquí exige revisar `/privacidad` y viceversa.
