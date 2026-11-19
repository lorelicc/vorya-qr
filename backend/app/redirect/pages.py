"""Branded page for paused, deleted or suspended dynamic QR codes (and unknown links)."""

INACTIVE_HTML = """<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>QR non attivo | Vorya QR</title>
<link rel="icon" href="/assets/branding/vorya_v.png">
<style>
:root{--g1:#00e99a;--g2:#00ba78;--g3:#087f5b;--g4:#064b38;--ink:#091411;--muted:#567067;
--canvas:#f5faf7;--mint:#d8fae9;--line:#d3e7dc}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
background:var(--canvas);color:var(--ink);font:16px/1.5 Arial,Helvetica,sans-serif}
main{width:100%;max-width:440px;padding:32px;border-radius:20px;background:#fff;
box-shadow:0 16px 60px rgba(9,20,17,.07);text-align:center}
.bar{height:6px;border-radius:999px;margin:-8px 0 24px;
background:linear-gradient(135deg,var(--g1) 0%,var(--g2) 42%,var(--g3) 75%,var(--g4) 100%)}
img{width:180px;max-width:100%;height:auto}
.art{display:block;margin:20px auto 0;max-width:100%;height:auto}
h1{font-size:23px;line-height:1.3;margin:20px 0 8px}
p{margin:0;color:var(--muted);font-size:15px}
.report{margin-top:20px;font-size:13px}.report a{color:var(--g3)}
</style></head>
<body><main><div class="bar"></div>
<img src="/assets/branding/vorya_qr.png" alt="Vorya QR">
<svg class="art" viewBox="0 0 240 150" width="200" height="125" aria-hidden="true">
<path fill="var(--mint)" d="M64 82c0-30 24-48 56-48s58 16 58 44-28 46-58 46-56-14-56-42Z"/>
<rect x="84" y="30" width="72" height="72" rx="14" fill="#fff" stroke="var(--line)" stroke-width="1.5"/>
<g fill="none" stroke="var(--line)" stroke-width="5"><rect x="98" y="44" width="16" height="16" rx="4"/>
<rect x="126" y="44" width="16" height="16" rx="4"/><rect x="98" y="72" width="16" height="16" rx="4"/></g>
<rect x="128" y="74" width="12" height="12" rx="3" fill="var(--line)"/>
<circle cx="152" cy="98" r="15" fill="var(--g3)"/><path d="M146 98h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>
<h1>QR non attivo</h1>
<p>Questo codice QR non è al momento attivo. Se pensi che sia un errore, contatta chi te
lo ha fornito.</p>
<p class="report"><a href="/report">Segnala un QR sospetto</a></p>
</main></body></html>"""
