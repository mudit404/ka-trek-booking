/**
 * Summarize a HAR capture into an endpoint table, grouped by host + path.
 *
 *   npm run recon:summarize -- recon/fixtures/full-booking.har [--host aranyavihaara.karnataka.gov.in]
 *
 * Prints method, path, status, content-type, size and timing so the portal's
 * API surface is visible at a glance. Does not print bodies, headers or cookies.
 */
import { readFileSync } from "node:fs";

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: { method: string; url: string; postData?: { mimeType?: string } };
  response: { status: number; content: { mimeType?: string; size?: number } };
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: har-summarize <file.har> [--host <host>] [--all]");
  process.exit(1);
}
const hostFilter = args.includes("--host") ? args[args.indexOf("--host") + 1] : undefined;
const showAll = args.includes("--all");

const har = JSON.parse(readFileSync(file, "utf8")) as { log: { entries: HarEntry[] } };

const rows = har.log.entries
  .map((e) => {
    const u = new URL(e.request.url);
    return {
      t: e.startedDateTime,
      method: e.request.method,
      host: u.host,
      path: u.pathname,
      query: u.search ? "?" : "",
      status: e.response.status,
      type: (e.response.content.mimeType ?? "").split(";")[0] ?? "",
      reqType: (e.request.postData?.mimeType ?? "").split(";")[0] ?? "",
      bytes: e.response.content.size ?? 0,
      ms: Math.round(e.time),
    };
  })
  .filter((r) => !hostFilter || r.host === hostFilter)
  .filter((r) => showAll || !/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|map)$/i.test(r.path));

const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(
  [pad("TIME", 24), pad("METHOD", 7), pad("STATUS", 7), pad("RESP-TYPE", 18), pad("REQ-TYPE", 18), pad("MS", 6), "PATH"].join(" "),
);
for (const r of rows) {
  console.log(
    [pad(r.t.slice(11, 23), 24), pad(r.method, 7), pad(r.status, 7), pad(r.type, 18), pad(r.reqType, 18), pad(r.ms, 6), `${r.host}${r.path}${r.query}`].join(" "),
  );
}

// Distinct endpoints
const distinct = new Map<string, number>();
for (const r of rows) {
  const key = `${r.method} ${r.host}${r.path}`;
  distinct.set(key, (distinct.get(key) ?? 0) + 1);
}
console.log(`\n${distinct.size} distinct endpoints:`);
for (const [k, n] of [...distinct.entries()].sort()) console.log(`  ${pad(n, 4)} ${k}`);
