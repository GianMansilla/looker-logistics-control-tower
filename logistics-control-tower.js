// ============================================================
// Looker Custom Visualization — Logistics Control Tower
// Autor: Gian Mansilla · deck.gl v9 (_GlobeView)
// Version: 1.0 — Global 3D logistics dashboard
// ============================================================
console.log("Logistics Control Tower custom viz · v1.0 loaded");
// Setup en Looker Admin > Visualizations:
//   - Main JS URL: URL pública de este archivo
//   - Dependencies: https://cdn.jsdelivr.net/npm/deck.gl@9.0.38/dist.min.js
//
// Query esperada (dimensiones y measures, resueltas por LookML tags):
//   Dimensions:
//     origin_id, origin_name, origin_region       [tags: origin_id, origin_name, origin_region]
//     dest_id,   dest_name,   dest_region         [tags: dest_id, dest_name, dest_region]
//     transport_mode, product_category, priority  [tags: transport_mode, product_category, priority]
//   Measures:
//     origin_lat, origin_lng                      [tags: origin_lat, origin_lng]
//     dest_lat, dest_lng                          [tags: dest_lat, dest_lng]
//     volume_teu, delay_days                      [tags: volume_teu, delay_days]
//
// Los filtros por transport_mode, product_category, priority, region se aplican
// vía dashboard filters nativos sobre las dimensiones correspondientes.
//
// LookML tags recomendados (ver lookml/example.model.lkml en el repo).
// Si no hay tags, el viz cae a matching por nombre y luego posicional.
// ============================================================

const COUNTRIES_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

const COLOR_PALETTES = {
  neon:    { onTime: [0, 255, 200], minor: [255, 204, 0], critical: [255, 32, 80] },
  fire:    { onTime: [255, 220, 60], minor: [255, 128, 0], critical: [225, 32, 32] },
  ocean:   { onTime: [34, 211, 238], minor: [125, 211, 252], critical: [244, 114, 182] },
  monochrome: { onTime: [220, 220, 220], minor: [160, 160, 160], critical: [255, 90, 90] },
};

const GLOBE_THEMES = {
  midnight: { space1: "#0a1420", space2: "#000000", ocean: [15, 25, 40], land: [25, 35, 48], border: [80, 110, 130, 120] },
  slate:    { space1: "#0f1620", space2: "#050810", ocean: [22, 32, 44], land: [40, 52, 66], border: [110, 140, 160, 130] },
  abyss:    { space1: "#000814", space2: "#000000", ocean: [8, 14, 22], land: [16, 24, 34], border: [50, 80, 100, 100] },
};

// Cache global GeoJSON so we don't refetch on every update
let COUNTRIES_GEOJSON = null;
let COUNTRIES_PROMISE = null;
function loadCountries() {
  if (COUNTRIES_GEOJSON) return Promise.resolve(COUNTRIES_GEOJSON);
  if (COUNTRIES_PROMISE) return COUNTRIES_PROMISE;
  COUNTRIES_PROMISE = fetch(COUNTRIES_URL)
    .then(r => r.json())
    .then(g => { COUNTRIES_GEOJSON = g; return g; });
  return COUNTRIES_PROMISE;
}

looker.plugins.visualizations.add({
  id: "logistics_control_tower",
  label: "Logistics Control Tower",

  // ============================================================
  // OPTIONS — Panel de configuración generado por Looker
  // ============================================================
  options: {
    // --- Globo ---
    globe_theme: {
      type: "string", label: "Tema del globo", display: "select",
      values: [
        { "Midnight": "midnight" },
        { "Slate": "slate" },
        { "Abyss": "abyss" }
      ],
      default: "midnight", section: "Globo", order: 1
    },
    show_country_labels: {
      type: "boolean", label: "Nombres de países",
      default: true, section: "Globo", order: 2
    },
    label_pop_threshold: {
      type: "number", label: "Umbral población para labels (millones)", display: "range",
      min: 5, max: 100, step: 5, default: 20, section: "Globo", order: 3
    },
    show_borders: {
      type: "boolean", label: "Fronteras de países",
      default: true, section: "Globo", order: 4
    },

    // --- Rotación ---
    auto_rotate: {
      type: "boolean", label: "Rotación automática",
      default: true, section: "Rotación", order: 1
    },
    rotate_speed: {
      type: "number", label: "Velocidad de rotación", display: "range",
      min: 0, max: 0.3, step: 0.01, default: 0.08, section: "Rotación", order: 2
    },
    cinematic_entrance: {
      type: "boolean", label: "Entrada cinemática al cargar",
      default: true, section: "Rotación", order: 3
    },

    // --- Rutas ---
    show_arcs: {
      type: "boolean", label: "Mostrar arcos de rutas",
      default: true, section: "Rutas", order: 1
    },
    show_particles: {
      type: "boolean", label: "Partículas animadas (cometas)",
      default: true, section: "Rutas", order: 2
    },
    particle_speed: {
      type: "number", label: "Velocidad de partículas", display: "range",
      min: 0.001, max: 0.02, step: 0.001, default: 0.006, section: "Rutas", order: 3
    },
    arc_width_scale: {
      type: "number", label: "Escala de grosor de arcos", display: "range",
      min: 0.05, max: 0.6, step: 0.05, default: 0.15, section: "Rutas", order: 4
    },
    arc_opacity: {
      type: "number", label: "Opacidad de arcos", display: "range",
      min: 0.1, max: 1, step: 0.05, default: 0.55, section: "Rutas", order: 5
    },

    // --- Hubs ---
    show_hub_columns: {
      type: "boolean", label: "Columnas 3D en hubs",
      default: true, section: "Hubs", order: 1
    },
    hub_elevation_scale: {
      type: "number", label: "Escala de altura de columnas", display: "range",
      min: 20, max: 300, step: 10, default: 80, section: "Hubs", order: 2
    },
    hub_radius: {
      type: "number", label: "Radio de columnas (km)", display: "range",
      min: 20, max: 200, step: 10, default: 60, section: "Hubs", order: 3
    },
    show_hub_glow: {
      type: "boolean", label: "Halo bajo hubs",
      default: true, section: "Hubs", order: 4
    },

    // --- Colores / Umbrales ---
    color_palette: {
      type: "string", label: "Paleta de status", display: "select",
      values: [
        { "Neon (por defecto)": "neon" },
        { "Fire (yellow-red)": "fire" },
        { "Ocean (cool tones)": "ocean" },
        { "Monochrome": "monochrome" },
        { "Personalizada (colores abajo)": "custom" }
      ],
      default: "neon", section: "Colores", order: 1
    },
    color_ontime:   { type: "string", label: "Color · On time",  display: "color", default: "#00ffc8", section: "Colores", order: 2 },
    color_minor:    { type: "string", label: "Color · Minor delay", display: "color", default: "#ffcc00", section: "Colores", order: 3 },
    color_critical: { type: "string", label: "Color · Critical delay", display: "color", default: "#ff2050", section: "Colores", order: 4 },
    minor_threshold: {
      type: "number", label: "Umbral 'minor delay' (días)", display: "range",
      min: 1, max: 10, step: 1, default: 2, section: "Colores", order: 5
    },
    critical_threshold: {
      type: "number", label: "Umbral 'critical delay' (días)", display: "range",
      min: 3, max: 20, step: 1, default: 5, section: "Colores", order: 6
    },

    // --- HUD ---
    show_title:  { type: "boolean", label: "Título",   default: true, section: "HUD", order: 1 },
    show_stats:  { type: "boolean", label: "Stats (routes / volume / delayed)", default: true, section: "HUD", order: 2 },
    show_legend: { type: "boolean", label: "Leyenda",  default: true, section: "HUD", order: 3 },
    show_clock:  { type: "boolean", label: "Reloj UTC", default: true, section: "HUD", order: 4 },
    title_text:  {
      type: "string", label: "Texto del título",
      default: "Control Tower", section: "HUD", order: 5
    },
    subtitle_text: {
      type: "string", label: "Texto del subtítulo",
      default: "Real-time freight monitoring", section: "HUD", order: 6
    },
  },

  // ============================================================
  // CREATE — Se ejecuta una vez al montar el viz
  // ============================================================
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .lct-w {
          position: relative; width: 100%; height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e0f7ff; overflow: hidden;
          background: radial-gradient(ellipse at center, #0a1420 0%, #000000 75%);
        }
        .lct-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .lct-hud {
          position: absolute; z-index: 10;
          background: rgba(8, 14, 22, 0.75);
          border: 1px solid rgba(0, 255, 200, 0.25);
          border-radius: 6px; padding: 12px 16px;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 0 30px rgba(0, 255, 200, 0.08);
          pointer-events: none;
        }
        .lct-hud-title { font-size: 10px; letter-spacing: 3px; color: #00ffc8; text-transform: uppercase; margin-bottom: 5px; }
        .lct-hud-main  { font-size: 20px; font-weight: 300; letter-spacing: 1px; color: #ffffff; }
        .lct-hud-sub   { font-size: 10px; color: #7a99a8; margin-top: 3px; }
        .lct-title    { top: 16px; left: 16px; }
        .lct-stats    { top: 16px; right: 16px; text-align: right; display: flex; gap: 20px; }
        .lct-legend   { bottom: 16px; left: 16px; font-size: 10px; }
        .lct-clock    { bottom: 16px; right: 16px; text-align: right; }
        .lct-legend .row { display: flex; align-items: center; margin: 3px 0; color: #a8c5d0; }
        .lct-legend .dot { width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; box-shadow: 0 0 8px currentColor; }
        .lct-tip {
          position: absolute; z-index: 20; pointer-events: none;
          background: rgba(8, 14, 22, 0.92);
          border: 1px solid rgba(0, 255, 200, 0.4);
          border-radius: 4px; padding: 9px 12px; font-size: 11px; color: #e0f7ff;
          box-shadow: 0 0 20px rgba(0, 255, 200, 0.2);
          display: none; max-width: 260px;
        }
        .lct-tt-title { font-size: 9px; letter-spacing: 2px; color: #00ffc8; text-transform: uppercase; margin-bottom: 5px; }
        .lct-tt-name { font-size: 13px; font-weight: 600; margin-bottom: 5px; }
        .lct-tt-row { display: flex; justify-content: space-between; gap: 18px; margin: 2px 0; }
        .lct-tt-label { color: #7a99a8; }
        .lct-tt-value { color: #fff; font-weight: 500; }
        .lct-loading {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: #000; color: #00ffc8; font-size: 11px; letter-spacing: 3px;
          z-index: 100; transition: opacity 0.6s;
        }
      </style>
      <div class="lct-w" id="lct-w">
        <canvas class="lct-canvas" id="lct-canvas"></canvas>
        <div class="lct-tip" id="lct-tip"></div>
        <div class="lct-hud lct-title" id="lct-title">
          <div class="lct-hud-title">Global Logistics</div>
          <div class="lct-hud-main" id="lct-title-main">Control Tower</div>
          <div class="lct-hud-sub"  id="lct-title-sub">Real-time freight monitoring</div>
        </div>
        <div class="lct-hud lct-stats" id="lct-stats">
          <div><div class="lct-hud-title">Active Routes</div><div class="lct-hud-main" id="lct-stat-routes">—</div></div>
          <div><div class="lct-hud-title">In Transit</div><div class="lct-hud-main" id="lct-stat-volume">—</div></div>
          <div><div class="lct-hud-title">Delayed</div><div class="lct-hud-main" id="lct-stat-delayed" style="color:#ff2050;">—</div></div>
        </div>
        <div class="lct-hud lct-legend" id="lct-legend">
          <div class="lct-hud-title" style="margin-bottom:6px;">Route Status</div>
          <div class="row"><span class="dot" id="lct-lg-ontime" style="background:#00ffc8;color:#00ffc8;"></span>On schedule</div>
          <div class="row"><span class="dot" id="lct-lg-minor"  style="background:#ffcc00;color:#ffcc00;"></span>Minor delay</div>
          <div class="row"><span class="dot" id="lct-lg-crit"   style="background:#ff2050;color:#ff2050;"></span>Critical delay</div>
        </div>
        <div class="lct-hud lct-clock" id="lct-clock">
          <div class="lct-hud-title">UTC</div>
          <div class="lct-hud-main" id="lct-clock-time">—</div>
          <div class="lct-hud-sub" id="lct-clock-date">—</div>
        </div>
        <div class="lct-loading" id="lct-loading">INITIALIZING CONTROL TOWER…</div>
      </div>
    `;

    // Instance state stored on element to persist across updates
    element._lct = {
      deckInstance: null,
      viewState: { longitude: 0, latitude: 20, zoom: 0 },
      arcData: [], hubLoad: [],
      arcAnimTime: 0,
      entranceStart: null,
      autoRotate: true,
      userInteracting: false,
      config: config,
      rafId: null,
    };

    // Clock
    function tickClock() {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2,'0');
      const mm = String(now.getUTCMinutes()).padStart(2,'0');
      const ss = String(now.getUTCSeconds()).padStart(2,'0');
      const t = element.querySelector('#lct-clock-time');
      const d = element.querySelector('#lct-clock-date');
      if (t) t.textContent = `${hh}:${mm}:${ss}`;
      if (d) d.textContent = now.toUTCString().split(' ').slice(0,4).join(' ');
    }
    tickClock();
    element._lct.clockInterval = setInterval(tickClock, 1000);

    // Wait for deck.gl to be available
    const initDeck = () => {
      if (typeof deck === 'undefined') { setTimeout(initDeck, 100); return; }
      loadCountries().then(() => {
        setupDeckInstance(element);
      });
    };
    initDeck();
  },

  // ============================================================
  // UPDATE ASYNC — Se ejecuta cada vez que cambian data o config
  // ============================================================
  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (!handleErrors(this, queryResponse)) { done(); return; }

    const dims = queryResponse.fields.dimension_like;
    const mess = queryResponse.fields.measure_like;

    const F = {
      origin_id:     resolveField(dims, "origin_id",     0, ["origin_id","origin"]),
      origin_name:   resolveField(dims, "origin_name",   1, ["origin_name"]),
      origin_region: resolveField(dims, "origin_region", 2, ["origin_region"]),
      dest_id:       resolveField(dims, "dest_id",       3, ["dest_id","destination_id"]),
      dest_name:     resolveField(dims, "dest_name",     4, ["dest_name","destination_name"]),
      dest_region:   resolveField(dims, "dest_region",   5, ["dest_region","destination_region"]),
      transport:     resolveField(dims, "transport_mode",6, ["transport_mode","mode"]),
      category:      resolveField(dims, "product_category", 7, ["product_category","category"]),
      priority:      resolveField(dims, "priority",      8, ["priority"]),
      origin_lat:    resolveField(mess, "origin_lat",    0, ["origin_lat","o_lat"]),
      origin_lng:    resolveField(mess, "origin_lng",    1, ["origin_lng","o_lng","origin_lon"]),
      dest_lat:      resolveField(mess, "dest_lat",      2, ["dest_lat","d_lat","destination_lat"]),
      dest_lng:      resolveField(mess, "dest_lng",      3, ["dest_lng","d_lng","destination_lng","destination_lon"]),
      volume:        resolveField(mess, "volume_teu",    4, ["volume_teu","volume","teu"]),
      delay:         resolveField(mess, "delay_days",    5, ["delay_days","delay","days_delayed"]),
    };

    // Read numeric safely
    const num = (row, key) => {
      const v = row[key];
      if (v === undefined || v === null) return 0;
      return typeof v.value === "number" ? v.value : parseFloat(v.value) || 0;
    };
    const str = (row, key) => {
      if (!key || !row[key]) return "";
      return String(row[key].value ?? "");
    };

    // Build normalized arc rows
    const arcData = data.map(row => ({
      from: [num(row, F.origin_lng), num(row, F.origin_lat)],
      to:   [num(row, F.dest_lng),   num(row, F.dest_lat)],
      fromId:   str(row, F.origin_id),
      toId:     str(row, F.dest_id),
      fromName: str(row, F.origin_name),
      toName:   str(row, F.dest_name),
      fromRegion: str(row, F.origin_region),
      toRegion:   str(row, F.dest_region),
      transport:  str(row, F.transport),
      category:   str(row, F.category),
      priority:   str(row, F.priority),
      volume:     num(row, F.volume),
      delay:      num(row, F.delay),
    })).filter(d => d.from[0] !== 0 && d.to[0] !== 0);

    // Aggregate hub load from arc rows
    const hubMap = new Map();
    arcData.forEach(d => {
      const oKey = d.fromId || (d.from[0]+","+d.from[1]);
      const dKey = d.toId   || (d.to[0]+","+d.to[1]);
      if (!hubMap.has(oKey)) hubMap.set(oKey, { id: d.fromId, name: d.fromName, region: d.fromRegion, coord: d.from, inbound: 0, outbound: 0, delays: [] });
      if (!hubMap.has(dKey)) hubMap.set(dKey, { id: d.toId,   name: d.toName,   region: d.toRegion,   coord: d.to,   inbound: 0, outbound: 0, delays: [] });
      hubMap.get(oKey).outbound += d.volume;
      hubMap.get(dKey).inbound  += d.volume;
      hubMap.get(oKey).delays.push(d.delay);
      hubMap.get(dKey).delays.push(d.delay);
    });
    const hubLoad = [...hubMap.values()].map(h => ({
      ...h,
      volume: h.inbound + h.outbound,
      avgDelay: h.delays.length ? h.delays.reduce((s,x) => s+x, 0)/h.delays.length : 0,
    }));

    // Save into element state
    const s = element._lct;
    s.arcData = arcData;
    s.hubLoad = hubLoad;
    s.config = config;

    // Update HUD
    applyHudVisibility(element, config);
    updateHudStats(element, arcData, config);
    updateLegendColors(element, config);

    // Force layer rebuild via next animation frame (already runs)
    if (s.deckInstance) {
      s.deckInstance.setProps({ layers: buildLayers(s, config) });
    }

    done();
  },

  // Called by Looker when the tile is removed
  destroy: function(element) {
    if (element._lct) {
      if (element._lct.rafId) cancelAnimationFrame(element._lct.rafId);
      if (element._lct.clockInterval) clearInterval(element._lct.clockInterval);
      if (element._lct.deckInstance) {
        try { element._lct.deckInstance.finalize(); } catch(e) {}
      }
    }
  }
});

// ============================================================
// Deck.gl instance setup + animation loop
// ============================================================
function setupDeckInstance(element) {
  const s = element._lct;
  const canvas = element.querySelector('#lct-canvas');
  const tipEl  = element.querySelector('#lct-tip');
  const GlobeView = deck._GlobeView || deck.GlobeView;

  s.deckInstance = new deck.Deck({
    canvas: canvas,
    views: new GlobeView({ id: 'globe', controller: true }),
    initialViewState: s.viewState,
    onViewStateChange: ({ viewState: vs }) => {
      s.viewState = vs;
      s.deckInstance.setProps({ viewState: vs });
    },
    onHover: info => {
      if (!info || !info.object) { tipEl.style.display = 'none'; return; }
      const html = tooltipHtml(info, s.config);
      if (!html) { tipEl.style.display = 'none'; return; }
      tipEl.innerHTML = html;
      tipEl.style.display = 'block';
      const pad = 12;
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      const parent = element.getBoundingClientRect();
      const posX = (info.x + w + pad*2 > parent.width) ? info.x - w - pad : info.x + pad;
      const posY = (info.y + h + pad*2 > parent.height) ? info.y - h - pad : info.y + pad;
      tipEl.style.left = posX + 'px';
      tipEl.style.top  = posY + 'px';
    },
    layers: buildLayers(s, s.config),
  });

  // Interaction detection
  ['mousedown','touchstart','wheel'].forEach(evt =>
    canvas.addEventListener(evt, () => { s.userInteracting = true; s.autoRotate = false; })
  );
  ['mouseup','touchend'].forEach(evt =>
    canvas.addEventListener(evt, () => {
      s.userInteracting = false;
      clearTimeout(s._rotResume);
      s._rotResume = setTimeout(() => { s.autoRotate = true; }, 5000);
    })
  );

  // Animation loop
  function animate(ts) {
    const cfg = s.config || {};
    if (s.entranceStart === null) s.entranceStart = ts;
    const elapsed = ts - s.entranceStart;
    const ENTRANCE = 3500;

    if (cfg.cinematic_entrance !== false && elapsed < ENTRANCE) {
      const t = 1 - Math.pow(1 - elapsed / ENTRANCE, 3);
      s.viewState = { ...s.viewState, zoom: t * 1.3, longitude: -30 * t, latitude: 20 };
    } else if (cfg.auto_rotate !== false && s.autoRotate && !s.userInteracting) {
      const speed = cfg.rotate_speed !== undefined ? cfg.rotate_speed : 0.08;
      s.viewState = { ...s.viewState, longitude: s.viewState.longitude + speed };
    }

    const pspeed = cfg.particle_speed !== undefined ? cfg.particle_speed : 0.006;
    s.arcAnimTime = (s.arcAnimTime + pspeed) % 1;

    s.deckInstance.setProps({
      viewState: s.viewState,
      layers: buildLayers(s, cfg),
    });

    s.rafId = requestAnimationFrame(animate);
  }
  s.rafId = requestAnimationFrame(animate);

  // Fade splash
  setTimeout(() => {
    const l = element.querySelector('#lct-loading');
    if (l) { l.style.opacity = 0; setTimeout(() => l.remove(), 700); }
  }, 500);
}

// ============================================================
// Layer builder
// ============================================================
function buildLayers(state, config) {
  const cfg = config || {};
  const theme = GLOBE_THEMES[cfg.globe_theme] || GLOBE_THEMES.midnight;
  const palette = cfg.color_palette === "custom"
    ? { onTime: hexToRgb(cfg.color_ontime),  minor: hexToRgb(cfg.color_minor), critical: hexToRgb(cfg.color_critical) }
    : (COLOR_PALETTES[cfg.color_palette] || COLOR_PALETTES.neon);
  const minorTh    = cfg.minor_threshold    !== undefined ? cfg.minor_threshold    : 2;
  const criticalTh = cfg.critical_threshold !== undefined ? cfg.critical_threshold : 5;

  const delayColor = (delay, alpha = 220) => {
    const c = delay > criticalTh ? palette.critical
            : delay > minorTh    ? palette.minor
            : palette.onTime;
    return [c[0], c[1], c[2], alpha];
  };

  const layers = [];

  // 1. Ocean sphere
  layers.push(new deck.SolidPolygonLayer({
    id: 'lct-ocean',
    data: [{ polygon: [
      [-180, 90], [-90, 90], [0, 90], [90, 90], [180, 90],
      [180, -90], [90, -90], [0, -90], [-90, -90], [-180, -90]
    ]}],
    getPolygon: d => d.polygon,
    getFillColor: theme.ocean,
    stroked: false, filled: true,
  }));

  // 2. Countries
  if (COUNTRIES_GEOJSON) {
    layers.push(new deck.GeoJsonLayer({
      id: 'lct-countries',
      data: COUNTRIES_GEOJSON,
      filled: true,
      stroked: cfg.show_borders !== false,
      getFillColor: theme.land,
      getLineColor: theme.border,
      getLineWidth: 15000,
      lineWidthUnits: 'meters',
      lineWidthMinPixels: 0.5,
    }));

    // 3. Country labels
    if (cfg.show_country_labels !== false) {
      const popThreshold = (cfg.label_pop_threshold || 20) * 1e6;
      // Camera center on the globe
      const camLon = (state.viewState && state.viewState.longitude) || 0;
      const camLat = (state.viewState && state.viewState.latitude)  || 0;
      // Angular distance in degrees between (lon1,lat1) and (lon2,lat2)
      const angDist = (lon1, lat1, lon2, lat2) => {
        const toRad = Math.PI / 180;
        const dLat = (lat2 - lat1) * toRad;
        const dLon = (lon2 - lon1) * toRad;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 180 / Math.PI;
      };
      // Keep labels only for countries in the front-facing hemisphere (< 85° from camera)
      const labelFeatures = COUNTRIES_GEOJSON.features.filter(f => {
        const p = f.properties || {};
        if (!(p.POP_EST > popThreshold)) return false;
        if (typeof p.LABEL_X !== "number" || typeof p.LABEL_Y !== "number") return false;
        return angDist(camLon, camLat, p.LABEL_X, p.LABEL_Y) < 85;
      });
      layers.push(new deck.TextLayer({
        id: 'lct-country-labels',
        data: labelFeatures,
        getPosition: f => [f.properties.LABEL_X, f.properties.LABEL_Y],
        getText: f => (f.properties.NAME || f.properties.name || '').toUpperCase(),
        getSize: 13,
        sizeUnits: 'pixels',
        getColor: [200, 220, 235, 230],
        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        fontWeight: 600,
        billboard: true,
        characterSet: 'auto',
        outlineWidth: 3,
        outlineColor: [0, 0, 0, 255],
        fontSettings: { sdf: true, fontSize: 48 },
        getPixelOffset: [0, 0],
        parameters: {
          depthCompare: 'always',
          depthWriteEnabled: false,
        },
      }));
    }
  }

  // 4. Hub glow
  if (cfg.show_hub_glow !== false && state.hubLoad.length) {
    layers.push(new deck.ScatterplotLayer({
      id: 'lct-hub-glow',
      data: state.hubLoad,
      pickable: false, stroked: false, filled: true,
      radiusUnits: 'meters',
      getPosition: d => d.coord,
      getRadius: d => Math.sqrt(d.volume) * 3500,
      getFillColor: d => {
        const c = delayColor(d.avgDelay, 30);
        return [c[0], c[1], c[2], 25];
      },
    }));
  }

  // 5. Hub 3D columns
  if (cfg.show_hub_columns !== false && state.hubLoad.length) {
    layers.push(new deck.ColumnLayer({
      id: 'lct-hub-columns',
      data: state.hubLoad,
      diskResolution: 24,
      radius: (cfg.hub_radius || 60) * 1000,
      extruded: true,
      pickable: true,
      elevationScale: cfg.hub_elevation_scale || 80,
      getPosition: d => d.coord,
      getFillColor: d => delayColor(d.avgDelay, 220),
      getElevation: d => d.volume,
      material: { ambient: 0.6, diffuse: 0.8, shininess: 40, specularColor: [80, 255, 220] },
    }));
  }

  // 6. Arcs
  if (cfg.show_arcs !== false && state.arcData.length) {
    const arcOpacity = Math.round((cfg.arc_opacity !== undefined ? cfg.arc_opacity : 0.55) * 255);
    layers.push(new deck.ArcLayer({
      id: 'lct-arcs',
      data: state.arcData,
      pickable: true,
      getSourcePosition: d => d.from,
      getTargetPosition: d => d.to,
      getSourceColor: [palette.onTime[0], palette.onTime[1], palette.onTime[2], Math.round(arcOpacity * 0.4)],
      getTargetColor: d => delayColor(d.delay, arcOpacity),
      getWidth: d => Math.max(1, Math.sqrt(d.volume) * (cfg.arc_width_scale || 0.15)),
      getHeight: 0.5,
    }));
  }

  // 7. Animated particles
  if (cfg.show_particles !== false && cfg.show_arcs !== false && state.arcData.length) {
    layers.push(new deck.ScatterplotLayer({
      id: 'lct-particles',
      data: state.arcData.flatMap((d, i) =>
        [0, 0.33, 0.66].map(offset => ({ ...d, phase: (state.arcAnimTime + offset + i * 0.07) % 1 }))
      ),
      pickable: false,
      radiusUnits: 'pixels',
      getPosition: d => slerp(d.from, d.to, d.phase),
      getRadius: d => 2 + Math.sqrt(d.volume) * 0.08,
      getFillColor: d => {
        const c = delayColor(d.delay, 255);
        const fade = Math.sin(d.phase * Math.PI);
        return [c[0], c[1], c[2], Math.round(255 * fade)];
      },
    }));
  }

  return layers;
}

// Great-circle interpolation (spherical linear interp)
function slerp(from, to, t) {
  const [lon1, lat1] = from, [lon2, lat2] = to;
  const toRad = Math.PI / 180, toDeg = 180 / Math.PI;
  const φ1 = lat1 * toRad, φ2 = lat2 * toRad;
  const λ1 = lon1 * toRad, λ2 = lon2 * toRad;
  const cosφ1 = Math.cos(φ1), cosφ2 = Math.cos(φ2);
  const sinφ1 = Math.sin(φ1), sinφ2 = Math.sin(φ2);
  const σ = Math.acos(Math.max(-1, Math.min(1, sinφ1*sinφ2 + cosφ1*cosφ2*Math.cos(λ2-λ1))));
  if (σ < 1e-6) return [lon1, lat1];
  const A = Math.sin((1-t)*σ)/Math.sin(σ);
  const B = Math.sin(t*σ)/Math.sin(σ);
  const x = A*cosφ1*Math.cos(λ1) + B*cosφ2*Math.cos(λ2);
  const y = A*cosφ1*Math.sin(λ1) + B*cosφ2*Math.sin(λ2);
  const z = A*sinφ1 + B*sinφ2;
  return [Math.atan2(y, x)*toDeg, Math.atan2(z, Math.sqrt(x*x+y*y))*toDeg];
}

function hexToRgb(hex) {
  if (!hex) return [128, 128, 128];
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c+c).join('') : h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// ============================================================
// HUD update helpers
// ============================================================
function applyHudVisibility(element, cfg) {
  const c = cfg || {};
  const show = (id, on) => {
    const el = element.querySelector(id);
    if (el) el.style.display = on ? '' : 'none';
  };
  show('#lct-title',  c.show_title  !== false);
  show('#lct-stats',  c.show_stats  !== false);
  show('#lct-legend', c.show_legend !== false);
  show('#lct-clock',  c.show_clock  !== false);

  // Custom title text
  const titleMain = element.querySelector('#lct-title-main');
  const titleSub  = element.querySelector('#lct-title-sub');
  if (titleMain) titleMain.textContent = c.title_text || 'Control Tower';
  if (titleSub)  titleSub.textContent  = c.subtitle_text || 'Real-time freight monitoring';
}

function updateHudStats(element, arcData, cfg) {
  const criticalTh = (cfg && cfg.critical_threshold !== undefined) ? cfg.critical_threshold : 5;
  const routes = arcData.length;
  const volume = arcData.reduce((s,d) => s+d.volume, 0);
  const delayed = arcData.filter(d => d.delay > criticalTh).length;
  const r = element.querySelector('#lct-stat-routes');
  const v = element.querySelector('#lct-stat-volume');
  const d = element.querySelector('#lct-stat-delayed');
  if (r) r.textContent = routes.toLocaleString();
  if (v) v.textContent = volume.toLocaleString();
  if (d) d.textContent = delayed;
}

function updateLegendColors(element, cfg) {
  const c = cfg || {};
  const p = c.color_palette === "custom"
    ? { onTime: c.color_ontime || '#00ffc8', minor: c.color_minor || '#ffcc00', critical: c.color_critical || '#ff2050' }
    : {
        onTime: rgbToHex((COLOR_PALETTES[c.color_palette] || COLOR_PALETTES.neon).onTime),
        minor:  rgbToHex((COLOR_PALETTES[c.color_palette] || COLOR_PALETTES.neon).minor),
        critical: rgbToHex((COLOR_PALETTES[c.color_palette] || COLOR_PALETTES.neon).critical),
      };
  const setDot = (id, color) => {
    const el = element.querySelector(id);
    if (el) { el.style.background = color; el.style.color = color; }
  };
  setDot('#lct-lg-ontime', p.onTime);
  setDot('#lct-lg-minor',  p.minor);
  setDot('#lct-lg-crit',   p.critical);
}

function rgbToHex(rgb) {
  return '#' + rgb.slice(0,3).map(x => x.toString(16).padStart(2,'0')).join('');
}

// ============================================================
// Tooltip
// ============================================================
function tooltipHtml(info, cfg) {
  const c = cfg || {};
  const minorTh    = c.minor_threshold    !== undefined ? c.minor_threshold    : 2;
  const criticalTh = c.critical_threshold !== undefined ? c.critical_threshold : 5;
  const o = info.object;
  const layerId = info.layer && info.layer.id;
  if (!o) return null;

  if (layerId === 'lct-hub-columns') {
    return `
      <div class="lct-tt-title">Distribution Hub</div>
      <div class="lct-tt-name">${escapeHtml(o.name || o.id || '')}</div>
      ${o.region ? `<div class="lct-tt-row"><span class="lct-tt-label">Region</span><span class="lct-tt-value">${escapeHtml(o.region)}</span></div>` : ''}
      <div class="lct-tt-row"><span class="lct-tt-label">Inbound</span><span class="lct-tt-value">${Math.round(o.inbound).toLocaleString()}</span></div>
      <div class="lct-tt-row"><span class="lct-tt-label">Outbound</span><span class="lct-tt-value">${Math.round(o.outbound).toLocaleString()}</span></div>
      <div class="lct-tt-row"><span class="lct-tt-label">Avg delay</span><span class="lct-tt-value">${o.avgDelay.toFixed(1)} d</span></div>
    `;
  }
  if (layerId === 'lct-arcs') {
    const status = o.delay > criticalTh ? 'CRITICAL' : o.delay > minorTh ? 'DELAYED' : 'ON TIME';
    return `
      <div class="lct-tt-title">Trade Lane</div>
      <div class="lct-tt-name">${escapeHtml(o.fromName)} → ${escapeHtml(o.toName)}</div>
      ${o.transport ? `<div class="lct-tt-row"><span class="lct-tt-label">Mode</span><span class="lct-tt-value">${escapeHtml(o.transport)}</span></div>` : ''}
      ${o.category  ? `<div class="lct-tt-row"><span class="lct-tt-label">Category</span><span class="lct-tt-value">${escapeHtml(o.category)}</span></div>` : ''}
      ${o.priority  ? `<div class="lct-tt-row"><span class="lct-tt-label">Priority</span><span class="lct-tt-value">${escapeHtml(o.priority)}</span></div>` : ''}
      <div class="lct-tt-row"><span class="lct-tt-label">Volume</span><span class="lct-tt-value">${Math.round(o.volume).toLocaleString()} TEU</span></div>
      <div class="lct-tt-row"><span class="lct-tt-label">Delay</span><span class="lct-tt-value">${o.delay} d</span></div>
      <div class="lct-tt-row"><span class="lct-tt-label">Status</span><span class="lct-tt-value">${status}</span></div>
    `;
  }
  return null;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ============================================================
// Field resolver (tags → name → positional)
// ============================================================
function resolveField(fields, tag, positionalIdx, namePatterns) {
  const tagged = fields.find(f => {
    if (!f.tags) return false;
    if (Array.isArray(f.tags)) return f.tags.indexOf(tag) !== -1;
    if (typeof f.tags === "object") return Object.values(f.tags).indexOf(tag) !== -1;
    return false;
  });
  if (tagged) return tagged.name;

  if (namePatterns && namePatterns.length) {
    for (const pattern of namePatterns) {
      const p = pattern.toLowerCase();
      const matched = fields.find(f => {
        const last = (f.name || "").toLowerCase().split(".").pop();
        return last === p;
      });
      if (matched) return matched.name;
    }
  }
  return fields[positionalIdx] ? fields[positionalIdx].name : null;
}

function handleErrors(vis, res) {
  if (!res.fields.dimension_like.length) {
    vis.addError({ title: "Faltan dimensiones", message: "Se requieren dimensiones para origen/destino." });
    return false;
  }
  if (res.fields.measure_like.length < 6) {
    vis.addError({ title: "Faltan measures", message: "Se requieren al menos 6 measures: origin_lat, origin_lng, dest_lat, dest_lng, volume_teu, delay_days." });
    return false;
  }
  vis.clearErrors();
  return true;
}
