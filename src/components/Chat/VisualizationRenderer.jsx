'use client';

import { useRef, useEffect, useState } from 'react';

export default function VisualizationRenderer({ code, data, onError, retries }) {
  const iframeRef = useRef(null);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!code || !iframeRef.current) return;

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isDark = theme === 'dark';

    // Theme-adaptive colors matching the app's design system
    const textColor = isDark ? '#e0e0ef' : '#1a1a2e';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const legendBg = isDark ? 'rgba(18, 18, 40, 0.6)' : 'rgba(255, 255, 255, 0.7)';

    // Extended vibrant color palette
    const colorPalette = isDark
      ? ['#a855f7', '#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b']
      : ['#7c3aed', '#4f46e5', '#db2777', '#0891b2', '#d97706', '#059669', '#dc2626', '#6d28d9', '#475569'];

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: transparent;
      color: ${textColor};
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow: auto;
    }
    #chart {
      width: 100%;
      min-height: 420px;
      border-radius: 12px;
      overflow: hidden;
    }
    .modebar-btn path { fill: ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} !important; }
    .modebar-btn:hover path { fill: ${colorPalette[0]} !important; }
    .error {
      color: #ef4444;
      padding: 16px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
    }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    const THEME = {
      isDark: ${isDark},
      text: '${textColor}',
      grid: '${gridColor}',
      colors: ${JSON.stringify(colorPalette)},
    };

    const DEFAULT_LAYOUT = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Inter, system-ui, sans-serif', size: 13, color: '${textColor}' },
      margin: { t: 60, r: 30, b: 80, l: 60 },
      xaxis: { gridcolor: '${gridColor}', linecolor: '${gridColor}', zerolinecolor: '${gridColor}', tickfont: { color: '${textColor}', size: 11 }, title: { font: { color: '${textColor}' } } },
      yaxis: { gridcolor: '${gridColor}', linecolor: '${gridColor}', zerolinecolor: '${gridColor}', tickfont: { color: '${textColor}', size: 11 }, title: { font: { color: '${textColor}' } } },
      colorway: ${JSON.stringify(colorPalette)},
      hoverlabel: { font: { family: 'Inter, sans-serif', size: 12, color: '#ffffff' }, bordercolor: 'transparent' },
      transition: { duration: 500 },
      legend: {
        font: { color: '${textColor}', size: 12, family: 'Inter, sans-serif' },
        bgcolor: '${legendBg}',
        bordercolor: 'rgba(255,255,255,0.05)',
        borderwidth: 1,
        orientation: 'h',
        yanchor: 'top',
        y: -0.15,
        xanchor: 'center',
        x: 0.5,
      },
      title: { font: { color: '${textColor}', size: 16, family: 'Inter, sans-serif', weight: 600 } },
    };

    const DEFAULT_CONFIG = { responsive: true, displayModeBar: false };

    // Intercept Plotly.newPlot to force theme styles
    const _origNewPlot = Plotly.newPlot;
    Plotly.newPlot = function(id, traces, layout, config) {
      // Deep merge forced layout over whatever the LLM generated
      layout = layout || {};
      layout.paper_bgcolor = 'rgba(0,0,0,0)';
      layout.plot_bgcolor = 'rgba(0,0,0,0)';
      layout.font = Object.assign({}, DEFAULT_LAYOUT.font, layout.font || {});
      layout.font.color = '${textColor}';
      layout.font.family = 'Inter, system-ui, sans-serif';
      if (layout.title) {
        if (typeof layout.title === 'string') {
          layout.title = { text: layout.title, font: DEFAULT_LAYOUT.title.font };
        } else {
          layout.title.font = Object.assign({}, DEFAULT_LAYOUT.title.font, layout.title.font || {});
          layout.title.font.color = '${textColor}';
        }
      }
      // Force axis text colors
      if (layout.xaxis) {
        layout.xaxis.tickfont = Object.assign({}, { color: '${textColor}', size: 11 }, layout.xaxis.tickfont || {});
        layout.xaxis.tickfont.color = '${textColor}';
        if (layout.xaxis.title && typeof layout.xaxis.title === 'object') {
          layout.xaxis.title.font = Object.assign({}, { color: '${textColor}' }, layout.xaxis.title.font || {});
        }
        layout.xaxis.gridcolor = layout.xaxis.gridcolor || '${gridColor}';
      }
      if (layout.yaxis) {
        layout.yaxis.tickfont = Object.assign({}, { color: '${textColor}', size: 11 }, layout.yaxis.tickfont || {});
        layout.yaxis.tickfont.color = '${textColor}';
        if (layout.yaxis.title && typeof layout.yaxis.title === 'object') {
          layout.yaxis.title.font = Object.assign({}, { color: '${textColor}' }, layout.yaxis.title.font || {});
        }
        layout.yaxis.gridcolor = layout.yaxis.gridcolor || '${gridColor}';
      }
      // Force legend colors
      layout.legend = Object.assign({}, DEFAULT_LAYOUT.legend, layout.legend || {});
      layout.legend.font = Object.assign({}, DEFAULT_LAYOUT.legend.font, (layout.legend && layout.legend.font) || {});
      layout.legend.font.color = '${textColor}';
      layout.colorway = layout.colorway || ${JSON.stringify(colorPalette)};

      // Fix pie/donut charts — force text colors on traces
      if (Array.isArray(traces)) {
        traces.forEach(function(t) {
          if (t.type === 'pie') {
            t.textfont = Object.assign({}, t.textfont || {}, { color: '${textColor}', size: 12 });
            t.outsidetextfont = Object.assign({}, t.outsidetextfont || {}, { color: '${textColor}', size: 12 });
            t.insidetextfont = Object.assign({}, t.insidetextfont || {}, { color: '#ffffff', size: 11 });
            t.marker = t.marker || {};
            t.marker.colors = t.marker.colors || ${JSON.stringify(colorPalette)};
            t.marker.line = Object.assign({}, t.marker.line || {}, { color: '${isDark ? '#0a0a12' : '#ffffff'}', width: 2 });
          }
          if (t.type === 'bar' || !t.type) {
            t.marker = t.marker || {};
            t.marker.line = Object.assign({}, t.marker.line || {}, { width: 0 });
          }
        });
      }

      config = Object.assign({}, DEFAULT_CONFIG, config || {});
      return _origNewPlot.call(this, id, traces, layout, config);
    };

    try {
      const data = ${JSON.stringify(data || [])};
      ${code}
    } catch(e) {
      document.getElementById('chart').innerHTML = '<div class="error">Error: ' + e.message + '</div>';
      window.parent.postMessage({ type: 'viz-error', error: e.message }, '*');
    }
  <\/script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;

    return () => URL.revokeObjectURL(url);
  }, [code, data]);

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'viz-error') {
        setError(event.data.error);
        if (retries < 3 && onError) {
          onError(event.data.error);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onError, retries]);

  const containerStyle = fullscreen
    ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
      background: 'var(--bg-primary)',
      borderRadius: 0,
    }
    : {};

  return (
    <div className="viz-container" style={containerStyle}>
      <button
        className="viz-fullscreen-btn"
        onClick={() => setFullscreen(!fullscreen)}
      >
        {fullscreen ? '✕ Close' : '⛶ Fullscreen'}
      </button>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        style={{ height: fullscreen ? '100vh' : '480px', background: 'transparent' }}
      />
      {error && retries >= 3 && (
        <div className="viz-error">
          Failed after {retries} retries: {error}
        </div>
      )}
    </div>
  );
}
