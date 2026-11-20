// k6 load test for the redirect hot path: GET /r/{slug} -> 302 (no follow).
// Target: p95 < 100 ms at 200 req/s on 4 vCore / 16 GB.
// Usage: k6 run -e BASE=http://127.0.0.1:3200 -e SLUGS=slug1,slug2,... deploy/k6/redirect.js
import http from "k6/http";
import { check } from "k6";

const slugs = (__ENV.SLUGS || "demo").split(",");
export const options = {
  scenarios: {
    redirect: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 200),
      timeUnit: "1s",
      duration: __ENV.DURATION || "60s",
      preAllocatedVUs: 100,
      maxVUs: 400,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<100"],
  },
};

export default function () {
  const slug = slugs[Math.floor(Math.random() * slugs.length)];
  const r = http.get(`${__ENV.BASE || "http://127.0.0.1:3200"}/r/${slug}`, {
    redirects: 0,
    headers: { "User-Agent": "Mozilla/5.0 (iPhone) k6" },
  });
  check(r, { "302": (x) => x.status === 302 });
}
