# Logistics Control Tower · Looker Custom Visualization

Custom visualization para Looker que renderiza rutas logísticas globales sobre un **globo 3D interactivo** con arcos great-circle animados, partículas viajando por las rutas, columnas 3D en hubs con altura proporcional al volumen, y un panel de configuración completo generado automáticamente.

**Demo interactiva:** https://gianmansilla.github.io/looker-logistics-control-tower/

![Logistics Control Tower preview](https://via.placeholder.com/800x400/050810/00ffc8?text=Logistics+Control+Tower)

## Qué muestra

- **Globo 3D** (`_GlobeView` nativo de deck.gl v9) con countries y labels de Natural Earth
- **Arcos great-circle** entre origen y destino de cada trade lane
- **Columnas 3D** en cada hub con altura proporcional al volumen (inbound + outbound) y color según delay promedio
- **Partículas animadas** viajando por los arcos con interpolación esférica correcta
- **HUD flotante** con título configurable, stats en vivo, leyenda y reloj UTC
- **Tooltips** al hover sobre hubs y trade lanes con volumen, delay, status y atributos filtrables
- **Rotación automática** del globo (pausable con interacción del usuario)

## Instalación en Looker

1. En Looker: **Admin → Visualizations → Add Visualization**
2. Completar:
   - **ID:** `logistics_control_tower`
   - **Label:** `Logistics Control Tower`
   - **Main JavaScript URL:** `https://gianmansilla.github.io/looker-logistics-control-tower/logistics-control-tower.js`
   - **Dependencies:** `https://cdn.jsdelivr.net/npm/deck.gl@9.0.38/dist.min.js`
3. Guardar. El viz aparece disponible en cualquier Explore o Dashboard.

### Alternativa jsDelivr (recomendado para producción)

Pinneando a un tag para estabilidad:

```
https://cdn.jsdelivr.net/gh/gianmansilla/looker-logistics-control-tower@main/logistics-control-tower.js
```

## Query esperada

**Dimensiones:**

| Campo | Tag LookML | Descripción |
|---|---|---|
| `origin_id` | `origin_id` | Código corto del hub origen |
| `origin_name` | `origin_name` | Nombre del hub origen |
| `origin_region` | `origin_region` | Región del origen (APAC, EU, NA, LATAM, MEA, AFR) |
| `destination_id` | `dest_id` | Código corto del hub destino |
| `destination_name` | `dest_name` | Nombre del hub destino |
| `destination_region` | `dest_region` | Región del destino |
| `transport_mode` | `transport_mode` | `SEA` \| `AIR` \| `ROAD` |
| `product_category` | `product_category` | `ELECTRONICS` \| `APPAREL` \| `FOOD` \| `CHEMICALS` \| `MACHINERY` \| `AUTOMOTIVE` |
| `priority` | `priority` | `HIGH` \| `MEDIUM` \| `LOW` |

**Measures:**

| Campo | Tag LookML | Descripción |
|---|---|---|
| `origin_lat` | `origin_lat` | Latitud origen (float) |
| `origin_lng` | `origin_lng` | Longitud origen (float) |
| `destination_lat` | `dest_lat` | Latitud destino |
| `destination_lng` | `dest_lng` | Longitud destino |
| `volume_teu` | `volume_teu` | Volumen en TEU |
| `delay_days` | `delay_days` | Días de retraso |

Los tags LookML permiten que el viz no dependa del orden de las columnas. Si no hay tags, el viz cae a matching por nombre y luego posicional (ver `lookml/fact_trade_lanes.view.lkml`).

## Filtros

Los filtros por transport_mode, product_category, priority, region y hubs específicos se aplican vía **dashboard filters nativos de Looker** sobre las dimensiones correspondientes. El viz solo renderiza lo que recibe.

Ejemplos de filtros útiles:
- **Transport Mode = AIR** → solo rutas aéreas
- **Priority = HIGH** → solo trade lanes críticas
- **Product Category = FOOD** → cadena de suministro perecedera
- **Origin Region = APAC AND Destination Region = EU** → corredor Asia-Europa

## Opciones de configuración

Siete secciones en el panel de edit del viz:

**Globo**
- Tema del globo: Midnight / Slate / Abyss
- Nombres de países (on/off) + umbral de población para filtrar labels
- Fronteras de países (on/off)

**Rotación**
- Rotación automática (on/off)
- Velocidad de rotación (0–0.3)
- Entrada cinemática al cargar (on/off)

**Rutas**
- Mostrar arcos (on/off)
- Partículas animadas (on/off) + velocidad
- Escala de grosor y opacidad de arcos

**Hubs**
- Columnas 3D (on/off) + escala de altura + radio
- Halo bajo hubs (on/off)

**Colores**
- Paleta preset (Neon / Fire / Ocean / Monochrome) o personalizada con 3 color pickers
- Umbrales de minor delay y critical delay (días)

**HUD**
- Mostrar/ocultar título, stats, leyenda, reloj
- Texto del título y subtítulo configurables

## Dataset de ejemplo (BigQuery)

En `/data`:
- `schema.sql` — DDL de la tabla `fact_trade_lanes`
- `insert_data.sql` — Seed con 37 trade lanes globales estáticas
- `trade_lanes.csv` — Mismo dataset en CSV (para carga directa via BQ UI o `bq load`)

**Costo:** la tabla ocupa ~5 KB de storage y las queries desde Looker sobre 37 filas quedan holgadamente dentro del free tier de BigQuery. Cero costo operativo para la demo.

En `/lookml`:
- `fact_trade_lanes.view.lkml` — LookML view con tags mapeados al viz
- `logistics_demo.model.lkml` — Model con explore de ejemplo

## Autor

Gian Mansilla · [LinkedIn](https://www.linkedin.com/in/gianmansilla/)

## Licencia

MIT
