'use client';
// app/page.js — Real-time network traffic highway dashboard

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Vehicle definitions ────────────────────────────────────────────────────
const VEHICLES = {
  city_bus:   { label: 'DIRECT',   color: '#4C9BE8', w: 48, h: 22, name: 'City Bus',    speed: [1.0, 1.8] },
  sports_car: { label: 'SEARCH',   color: '#F05B5B', w: 34, h: 15, name: 'Sports Car',  speed: [2.8, 4.2] },
  box_truck:  { label: 'SOCIAL',   color: '#F5A623', w: 50, h: 24, name: 'Box Truck',   speed: [0.8, 1.5] },
  motorcycle: { label: 'PAID',     color: '#F5D63D', w: 24, h: 13, name: 'Motorcycle',  speed: [3.5, 5.0] },
  taxi:       { label: 'EMAIL',    color: '#3EC97B', w: 36, h: 16, name: 'Taxi',        speed: [1.5, 2.5] },
  sedan:      { label: 'MOBILE',   color: '#3DDBD9', w: 32, h: 15, name: 'Sedan',       speed: [1.8, 3.0] },
  panel_van:  { label: 'REFERRAL', color: '#A78BF5', w: 42, h: 20, name: 'Panel Van',   speed: [1.2, 2.2] },
  police_car: { label: '404',      color: '#F0F0F0', w: 34, h: 16, name: 'Police Car',  speed: [4.0, 6.0] },
  bicycle:    { label: 'BOT',      color: '#CCCCCC', w: 22, h: 13, name: 'Bicycle',     speed: [0.5, 1.0] },
  hatchback:  { label: 'OTHER',    color: '#888888', w: 30, h: 15, name: 'Hatchback',   speed: [1.0, 2.0] },
};

const LANES = 6;
const LANE_H = 52;

// ─── Drawing helpers ─────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circle(ctx, cx, cy, r, col) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
}

function drawVehicleShape(ctx, v, isSelected) {
  const def = VEHICLES[v.vehicleType] || VEHICLES.hatchback;
  const { x, y } = v;
  const { w, h, color } = def;

  ctx.save();
  ctx.globalAlpha = v.opacity ?? 1;

  // Body
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 5);
    ctx.stroke();
  }

  // Window tint
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x + 4, y + 3, w - 8, h - 6, 2);
  ctx.fill();

  // Label
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.min(8, h - 5)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.label.length > 6 ? def.label.slice(0, 5) : def.label, x + w / 2, y + h / 2);

  // Wheels
  if (v.vehicleType === 'motorcycle' || v.vehicleType === 'bicycle') {
    circle(ctx, x + 5, y + h + 1, 3, '#444');
    circle(ctx, x + w - 5, y + h + 1, 3, '#444');
  } else {
    circle(ctx, x + 7, y + h + 1, 3.5, '#333');
    circle(ctx, x + w - 7, y + h + 1, 3.5, '#333');
  }

  // Police lights
  if (v.vehicleType === 'police_car') {
    const t = Date.now() / 300;
    ctx.fillStyle = Math.sin(t) > 0 ? '#4C9BE8' : 'rgba(76,155,232,0.2)';
    ctx.fillRect(x + w / 2 - 6, y - 4, 5, 3);
    ctx.fillStyle = Math.sin(t) > 0 ? 'rgba(240,91,91,0.2)' : '#F05B5B';
    ctx.fillRect(x + w / 2 + 1, y - 4, 5, 3);
  }

  // Box truck extra body
  if (v.vehicleType === 'box_truck') {
    ctx.fillStyle = color + '44';
    roundRect(ctx, x, y - 5, w - 8, 7, 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TrafficHighway() {
  const canvasRef = useRef(null);
  const vehiclesRef = useRef([]);
  const selectedRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const statsRef = useRef({ total: 0, pps: 0, ppsCount: 0, ppsTimer: 0 });

  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ active: 0, total: 0, pps: 0 });
  const [summary, setSummary] = useState({});
  const [isLive, setIsLive] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 900, h: LANES * LANE_H });

  // Resize canvas to container
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth - 32, 1200);
      setDimensions({ w, h: LANES * LANE_H });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Spawn a vehicle from GA4 visitor data
  const spawnFromVisitor = useCallback((visitor, W) => {
    const def = VEHICLES[visitor.vehicleType] || VEHICLES.hatchback;
    const lane = Math.floor(Math.random() * LANES);
    const baseSpeed = def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]);
    return {
      ...visitor,
      lane,
      x: -def.w - 10,
      y: lane * LANE_H + (LANE_H - def.h) / 2,
      speed: baseSpeed * (visitor.speedMultiplier || 1),
      opacity: 1,
      _w: W,
    };
  }, []);

  // SSE connection
  useEffect(() => {
    let es;
    let spawnQueue = [];
    let spawnTimer = null;

    const connect = () => {
      es = new EventSource('/api/realtime');

      es.onopen = () => setIsLive(true);

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') {
          setIsMock(data.mock);
          return;
        }
        if (data.type === 'update' && data.visitors) {
          setSummary(data.summary?.byType || {});
          statsRef.current.total += data.visitors.length;

          // Queue visitors to drip-spawn as vehicles
          spawnQueue.push(...data.visitors);

          // Clear previous drip timer
          if (spawnTimer) clearInterval(spawnTimer);

          // Spawn one vehicle every 400ms from the queue
          spawnTimer = setInterval(() => {
            if (spawnQueue.length === 0) {
              clearInterval(spawnTimer);
              return;
            }
            const visitor = spawnQueue.shift();
            const W = dimensions.w;
            vehiclesRef.current.push(spawnFromVisitor(visitor, W));
            statsRef.current.ppsCount++;
          }, 400);
        }
      };

      es.onerror = () => {
        setIsLive(false);
        es.close();
        setTimeout(connect, 3000); // reconnect
      };
    };

    connect();
    return () => {
      es?.close();
      if (spawnTimer) clearInterval(spawnTimer);
    };
  }, [dimensions.w, spawnFromVisitor]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = dimensions.w;
    const H = dimensions.h;

    const loop = (ts) => {
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      // Update pps
      statsRef.current.ppsTimer += dt;
      if (statsRef.current.ppsTimer >= 1) {
        statsRef.current.pps = statsRef.current.ppsCount;
        statsRef.current.ppsCount = 0;
        statsRef.current.ppsTimer = 0;
      }

      // Move vehicles
      vehiclesRef.current.forEach(v => {
        v.x += v.speed * W * dt / 14;
      });

      // Remove off-screen
      vehiclesRef.current = vehiclesRef.current.filter(v => v.x < W + 80);

      // Update stats
      setStats({
        active: vehiclesRef.current.length,
        total: statsRef.current.total,
        pps: statsRef.current.pps,
      });

      // ── Draw ──
      ctx.clearRect(0, 0, W, H);

      // Road background
      for (let i = 0; i < LANES; i++) {
        const y = i * LANE_H;
        ctx.fillStyle = i % 2 === 0 ? '#1a1f2b' : '#141920';
        ctx.fillRect(0, y, W, LANE_H);
      }

      // Lane dividers
      ctx.setLineDash([18, 14]);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * LANE_H);
        ctx.lineTo(W, i * LANE_H);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Road border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.stroke();

      // Vehicles
      vehiclesRef.current.forEach(v => {
        drawVehicleShape(ctx, v, v === selectedRef.current);
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions]);

  // Click detection
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (dimensions.w / rect.width);
    const my = (e.clientY - rect.top) * (dimensions.h / rect.height);

    let hit = null;
    for (let i = vehiclesRef.current.length - 1; i >= 0; i--) {
      const v = vehiclesRef.current[i];
      const def = VEHICLES[v.vehicleType] || VEHICLES.hatchback;
      if (mx >= v.x && mx <= v.x + def.w && my >= v.y && my <= v.y + def.h) {
        hit = v;
        break;
      }
    }
    selectedRef.current = hit;
    setSelected(hit ? { ...hit } : null);
  }, [dimensions]);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'FBD Website traffic';

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>⬡</div>
          <div>
            <div style={styles.siteName}>{siteName}</div>
            <div style={styles.tagline}>Real-time visitor highway</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.dot(isLive)} />
          <span style={styles.liveLabel}>{isLive ? 'LIVE' : 'CONNECTING'}</span>
          {isMock && <span style={styles.mockBadge}>DEMO MODE</span>}
        </div>
      </div>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        {[
          { label: 'Active Visitors', value: stats.active },
          { label: 'Visitors/min', value: stats.pps },
          { label: 'Total (session)', value: stats.total },
          { label: 'Lanes', value: LANES },
        ].map(s => (
          <div key={s.label} style={styles.statItem}>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={styles.main}>
        {/* Highway canvas */}
        <div style={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={dimensions.w}
            height={dimensions.h}
            style={{ ...styles.canvas, width: '100%', height: dimensions.h }}
            onClick={handleCanvasClick}
          />
          {/* Click hint */}
          <div style={styles.hint}>Click any vehicle for details</div>
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Selected vehicle panel */}
          {selected ? (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div style={{
                  ...styles.panelBadge,
                  background: (VEHICLES[selected.vehicleType]?.color || '#888') + '22',
                  borderColor: (VEHICLES[selected.vehicleType]?.color || '#888') + '55',
                  color: VEHICLES[selected.vehicleType]?.color || '#888',
                }}>
                  {VEHICLES[selected.vehicleType]?.label || 'OTHER'}
                </div>
                <button style={styles.closeBtn} onClick={() => { setSelected(null); selectedRef.current = null; }}>✕</button>
              </div>
              <div style={styles.panelTitle}>{VEHICLES[selected.vehicleType]?.name || 'Vehicle'}</div>

              {[
                ['Source',   selected.source],
                ['Medium',   selected.medium],
                ['Page',     selected.pagePath],
                ['Device',   selected.device],
                ['Country',  selected.country],
                ['City',     selected.city],
                ['Recency',  selected.minutesAgo === 0 ? 'Just now' : `${selected.minutesAgo}m ago`],
                ['Page views', selected.pageViews],
                ['Speed',    `${selected.speed?.toFixed(1)}x`],
              ].map(([k, v]) => (
                <div key={k} style={styles.panelRow}>
                  <span style={styles.panelKey}>{k}</span>
                  <span style={styles.panelVal}>{v || '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.panelEmpty}>
              <div style={styles.panelEmptyIcon}>🚗</div>
              <div style={styles.panelEmptyText}>Click a vehicle on the highway to see visitor details</div>
            </div>
          )}

          {/* Traffic breakdown */}
          <div style={styles.breakdown}>
            <div style={styles.breakdownTitle}>Traffic Breakdown</div>
            {Object.entries(VEHICLES).map(([key, def]) => {
              const count = summary[key] || 0;
              const max = Math.max(...Object.values(summary), 1);
              return (
                <div key={key} style={styles.breakdownRow}>
                  <div style={styles.breakdownDot(def.color)} />
                  <div style={styles.breakdownLabel}>{def.name}</div>
                  <div style={styles.breakdownBar}>
                    <div style={{ ...styles.breakdownFill, width: `${(count / max) * 100}%`, background: def.color }} />
                  </div>
                  <div style={styles.breakdownCount}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(VEHICLES).map(([key, def]) => (
          <div key={key} style={styles.legendItem}>
            <div style={styles.legendDot(def.color)} />
            <span style={styles.legendText}>{def.name} = {def.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#e6edf3',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    padding: '16px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { fontSize: '28px', color: '#4C9BE8' },
  siteName: { fontSize: '18px', fontWeight: '700', letterSpacing: '0.04em', color: '#e6edf3' },
  tagline: { fontSize: '11px', color: '#8b949e', marginTop: '2px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  dot: (live) => ({
    width: '8px', height: '8px', borderRadius: '50%',
    background: live ? '#3EC97B' : '#F5A623',
    boxShadow: live ? '0 0 8px #3EC97B' : 'none',
  }),
  liveLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: '#8b949e' },
  mockBadge: {
    fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
    background: '#F5A62322', border: '0.5px solid #F5A62355', color: '#F5A623',
  },
  statsBar: {
    display: 'flex', gap: '12px', padding: '12px 16px',
    background: '#161b22', borderRadius: '8px', marginBottom: '12px',
    flexWrap: 'wrap',
  },
  statItem: { flex: '1', minWidth: '80px', textAlign: 'center' },
  statValue: { fontSize: '22px', fontWeight: '700', color: '#4C9BE8', lineHeight: '1' },
  statLabel: { fontSize: '10px', color: '#8b949e', marginTop: '4px', letterSpacing: '0.05em' },
  main: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  canvasWrap: { flex: 1, position: 'relative', minWidth: 0 },
  canvas: { borderRadius: '8px', cursor: 'crosshair', display: 'block' },
  hint: { fontSize: '10px', color: '#8b949e44', textAlign: 'center', marginTop: '6px' },
  sidebar: { width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  panel: {
    background: '#161b22', borderRadius: '10px',
    border: '0.5px solid rgba(255,255,255,0.1)', padding: '14px',
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  panelBadge: {
    fontSize: '10px', fontWeight: '700', padding: '2px 10px',
    borderRadius: '20px', border: '0.5px solid', letterSpacing: '0.08em',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#8b949e',
    cursor: 'pointer', fontSize: '13px', padding: '2px 6px',
  },
  panelTitle: { fontSize: '14px', fontWeight: '600', color: '#e6edf3', marginBottom: '10px' },
  panelRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' },
  panelKey: { fontSize: '11px', color: '#8b949e' },
  panelVal: { fontSize: '11px', color: '#e6edf3', fontWeight: '500', maxWidth: '140px', textAlign: 'right', wordBreak: 'break-all' },
  panelEmpty: {
    background: '#161b22', borderRadius: '10px',
    border: '0.5px solid rgba(255,255,255,0.07)',
    padding: '28px 16px', textAlign: 'center',
  },
  panelEmptyIcon: { fontSize: '32px', marginBottom: '10px' },
  panelEmptyText: { fontSize: '11px', color: '#8b949e', lineHeight: '1.6' },
  breakdown: {
    background: '#161b22', borderRadius: '10px',
    border: '0.5px solid rgba(255,255,255,0.07)', padding: '14px',
  },
  breakdownTitle: { fontSize: '11px', fontWeight: '700', color: '#8b949e', letterSpacing: '0.08em', marginBottom: '10px' },
  breakdownRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  breakdownDot: (color) => ({ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }),
  breakdownLabel: { fontSize: '10px', color: '#8b949e', width: '72px', flexShrink: 0 },
  breakdownBar: { flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: '2px', transition: 'width 0.6s ease' },
  breakdownCount: { fontSize: '10px', color: '#e6edf3', width: '20px', textAlign: 'right', flexShrink: 0 },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
    padding: '10px 14px', background: '#161b22',
    borderRadius: '8px', marginTop: '10px',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  legendDot: (color) => ({ width: '9px', height: '9px', borderRadius: '2px', background: color }),
  legendText: { fontSize: '10px', color: '#8b949e' },
};
