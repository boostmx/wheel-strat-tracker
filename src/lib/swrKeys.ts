// src/lib/swrKeys.ts
export const metricsKey = (pid: string) => `/api/portfolios/${pid}/metrics`;
export const openTradesKey = (pid: string) => `/api/trades?portfolioId=${pid}&status=open`;
export const closedTradesKey = (pid: string) => `/api/trades?portfolioId=${pid}&status=closed`;