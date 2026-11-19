// A tiny stand-in for the Stripe API used by the billing e2e: customers, Checkout, subscriptions.
// "Paying" on its checkout page sends signed webhooks to the real backend, like Stripe would.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 8210);
const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8100";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e";
const sessions = new Map();
const subs = new Map();
let counter = 0;
const RUN = Date.now().toString(36);

function parseForm(text) {
  const out = {};
  for (const [key, value] of new URLSearchParams(text)) out[key] = value;
  return out;
}
const json = (res, data, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

async function webhook(type, object) {
  const body = JSON.stringify({
    id: `evt_e2e_${RUN}_${++counter}`, object: "event", type, livemode: false, data: { object },
  }); // prettier-ignore
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  const res = await fetch(`${BACKEND}/api/public/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${v1}` },
    body,
  });
  if (!res.ok) console.error("webhook failed", type, res.status, await res.text());
}

function subscription(id, customer, price, meta) {
  return {
    id, object: "subscription", customer, status: "active", cancel_at_period_end: false,
    metadata: meta,
    items: { data: [{ id: "si_e2e", price: { id: price }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  }; // prettier-ignore
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const form = parseForm(raw);
  const path = url.pathname;

  if (path === "/") return res.end("ok");
  if (req.method === "POST" && /^\/v1\/customers(\/\w+)?$/.test(path))
    return json(res, {
      id:
        path.length > "/v1/customers".length
          ? path.split("/").pop()
          : `cus_e2e_${RUN}_${++counter}`,
      object: "customer",
    });
  if (req.method === "POST" && path === "/v1/checkout/sessions") {
    const id = `cs_e2e_${++counter}`;
    sessions.set(id, form);
    return json(res, { id, object: "checkout.session", url: `http://127.0.0.1:${PORT}/pay/${id}` });
  }
  const pay = path.match(/^\/pay\/(\w+)(\/confirm)?$/);
  if (pay) {
    const s = sessions.get(pay[1]);
    if (!s) return json(res, { error: "unknown" }, 404);
    if (!pay[2]) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(
        `<h1>Checkout di prova</h1><p>Prezzo: ${s["line_items[0][price]"]}</p>` +
          `<a href="/pay/${pay[1]}/confirm">Paga ora</a> <a href="${s.cancel_url}">Annulla</a>`,
      );
    }
    const meta = { workspace_id: s["metadata[workspace_id]"] };
    const customer = s.customer;
    const sub = subscription(`sub_${customer}`, customer, s["line_items[0][price]"], meta);
    subs.set(sub.id, sub);
    await webhook("customer.subscription.created", sub);
    await webhook("invoice.paid", {
      id: `in_e2e_${RUN}_${++counter}`, customer, amount_paid: 2900, currency: "eur",
      hosted_invoice_url: "https://example.com/receipt",
    }); // prettier-ignore
    res.writeHead(302, { Location: s.success_url.replace("{CHECKOUT_SESSION_ID}", pay[1]) });
    return res.end();
  }
  const sub = path.match(/^\/v1\/subscriptions\/(\w+)$/);
  if (sub && subs.has(sub[1])) {
    const current = subs.get(sub[1]);
    if (req.method === "POST") {
      if (form["items[0][price]"]) current.items.data[0].price = { id: form["items[0][price]"] };
      if (form.cancel_at_period_end)
        current.cancel_at_period_end = form.cancel_at_period_end === "true";
    }
    return json(res, current);
  }
  if (req.method === "POST" && path === "/v1/invoices/create_preview")
    return json(res, { amount_due: 5000, currency: "eur" });
  if (req.method === "POST" && path === "/v1/billing_portal/sessions")
    return json(res, { url: `http://127.0.0.1:${PORT}/portal` });
  json(res, { error: { message: `fake stripe: ${req.method} ${path}` } }, 404);
}).listen(PORT, "127.0.0.1");
