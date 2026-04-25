import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/portfolios/[id]/detail-metrics/route";

describe("GET /api/portfolios/[id]/detail-metrics", () => {
  it("redirects to /metrics with 307", async () => {
    const req = new Request("http://localhost/api/portfolios/port-1/detail-metrics?foo=bar");
    const res = await GET(req, { params: Promise.resolve({ id: "port-1" }) });
    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("/api/portfolios/port-1/metrics");
    expect(location).toContain("foo=bar");
  });
});
