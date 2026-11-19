"""Branded page for paused, deleted or suspended dynamic QR codes (and unknown links)."""

INACTIVE_HTML = """<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>QR non attivo | Vorya QR</title>
<link rel="icon" href="/assets/branding/vorya_v.png">
<style>
:root{--g1:#00e99a;--g2:#00ba78;--g3:#087f5b;--g4:#064b38;--ink:#091411;--muted:#567067;
--canvas:#f5faf7}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
background:var(--canvas);color:var(--ink);font:16px/1.5 Arial,Helvetica,sans-serif}
main{width:100%;max-width:440px;padding:32px;border-radius:20px;background:#fff;
box-shadow:0 16px 60px rgba(9,20,17,.07);text-align:center}
.bar{height:6px;border-radius:999px;margin:-8px 0 24px;
background:linear-gradient(135deg,var(--g1) 0%,var(--g2) 42%,var(--g3) 75%,var(--g4) 100%)}
img{width:180px;max-width:100%;height:auto}
h1{font-size:23px;line-height:1.3;margin:20px 0 8px}
p{margin:0;color:var(--muted);font-size:15px}
.report{margin-top:20px;font-size:13px}.report a{color:var(--g3)}
</style></head>
<body><main><div class="bar"></div>
<img src="/assets/branding/vorya_qr.png" alt="Vorya QR">
<h1>QR non attivo</h1>
<p>Questo codice QR non è al momento attivo. Se pensi che sia un errore, contatta chi te
lo ha fornito.</p>
<p class="report"><a href="/report">Segnala un QR sospetto</a></p>
</main></body></html>"""
