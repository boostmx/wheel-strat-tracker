import { prisma } from "@/server/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";

type CloseTradePayload = {
  closingContracts?: number;
  contractsToClose?: number;
  contracts?: number;
  closingContractPrice?: number;
  closingPrice?: number;
  price?: number;
  feesPerContract?: number;
  flatFees?: number;
  fullClose?: boolean;
  assignment?: boolean;
  assigned?: boolean;
  closeReason?: "manual" | "expiredWorthless" | "assigned";
  // Optional: also sell shares from the linked stock lot in the same transaction
  sellSharesPrice?: number;
  sharesToSell?: number;
};

//helpers to interpret trade types
const isShortOption = (type: string): boolean =>
  type === "CashSecuredPut" || type === "CoveredCall";

const isLongOption = (type: string): boolean =>
  type === "Put" || type === "Call";

const isCSP = (type: string): boolean => type === "CashSecuredPut";

const CONTRACT_MULTIPLIER = 100;

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = await props.params;
  const id = await params.id;

  const body: CloseTradePayload = await req
    .json()
    .catch(() => ({}) as CloseTradePayload);

  const isAssignment = body.assignment === true || body.assigned === true;
  const closeReason = body.closeReason ?? (isAssignment ? "assigned" : undefined);

  // Support both new and legacy payload shapes
  const contractsToCloseRaw = Number(
    body.closingContracts ?? body.contractsToClose ?? body.contracts,
  );
  const contractsToClose = Math.trunc(contractsToCloseRaw);
  const closingPriceRaw = body.closingContractPrice ?? body.closingPrice ?? body.price;
  const closingPrice = Number(closingPriceRaw);
  const feesPerContract = Number(body.feesPerContract ?? 0);
  const flatFees = Number(body.flatFees ?? 0);

  if (!Number.isFinite(contractsToClose) || contractsToClose <= 0) {
    return new Response("Invalid contractsToClose", { status: 400 });
  }
  // allow 0 for expiry / buyback at 0.00
  // for assignment we force closingPrice = 0 and do not require a provided value
  if (!isAssignment) {
    if (!Number.isFinite(closingPrice) || closingPrice < 0) {
      return new Response("Invalid closingPrice", { status: 400 });
    }
  }

  const isAdmin = session?.user?.isAdmin ?? false;
  const trade = await prisma.trade.findFirst({
    where: isAdmin ? { id } : { id, portfolio: { userId } },
  });
  if (!trade) return new Response("Trade not found", { status: 404 });
  const isCoveredCall = trade.type === "CoveredCall";
  const stockLotId = trade.stockLotId ?? null;

  // --- ASSIGNMENT PATH ---
  // CSP assigned: stock put to you → create a StockLot at net basis (strike - premium)
  // CC assigned:  stock called away → close the underlying StockLot
  if (isAssignment) {
    if (!isCSP(trade.type) && !isCoveredCall) {
      return new Response("Assignment is only supported for CSP and CoveredCall", {
        status: 400,
      });
    }

    if (trade.status !== "open") {
      return new Response("Trade is not open", { status: 400 });
    }
    if (!Number.isFinite(trade.contractPrice)) {
      return new Response("Trade.contractPrice missing/invalid", { status: 400 });
    }
    if (!trade.contractsOpen || trade.contractsOpen < contractsToClose) {
      return new Response("contractsToClose exceeds open contracts", { status: 400 });
    }

    const remainingAssigned = trade.contractsOpen - contractsToClose;
    const fullCloseFlagAssigned = body.fullClose;
    const isFullAssigned =
      typeof fullCloseFlagAssigned === "boolean"
        ? fullCloseFlagAssigned
        : remainingAssigned <= 0;

    if (!isFullAssigned) {
      return new Response("Assignment requires full close", { status: 400 });
    }

    const openPrice = Number(trade.contractPrice);
    const strike = Number(trade.strikePrice);
    if (!Number.isFinite(strike) || strike <= 0) {
      return new Response("Trade.strikePrice missing/invalid", { status: 400 });
    }

    const feesTotal = feesPerContract * contractsToClose + flatFees;
    const grossAssigned = openPrice * contractsToClose * CONTRACT_MULTIPLIER;
    const realizedAssigned = grossAssigned - feesTotal;
    const shares = contractsToClose * CONTRACT_MULTIPLIER;
    const now = new Date();

    if (isCSP(trade.type)) {
      // Stock put to you: create a new StockLot at net basis
      await prisma.$transaction(async (tx) => {
        const netBasis = Math.max(0, strike - openPrice);

        const createdLot = await tx.stockLot.create({
          data: {
            portfolioId: trade.portfolioId,
            ticker: trade.ticker,
            shares,
            avgCost: new Prisma.Decimal(netBasis),
            notes: `Assigned from CSP trade: ${trade.ticker} $${trade.strikePrice} ${formatDateOnlyUTC(trade.expirationDate)}`,
            status: "OPEN",
          },
          select: { id: true },
        });

        await tx.trade.update({
          where: { id },
          data: {
            status: "closed",
            closedAt: now,
            closingPrice: 0,
            contractsOpen: 0,
            premiumCaptured: (trade.premiumCaptured ?? 0) + realizedAssigned,
            percentPL: 100,
            closeReason: "assigned",
            stockLotId: createdLot.id,
            notes: trade.notes
              ? `${trade.notes}\nAssigned → created StockLot ${createdLot.id} @ ${strike}`
              : `Assigned → created StockLot ${createdLot.id} @ ${strike}`,
          },
        });
      });

      return new Response(
        JSON.stringify({ realizedNow: realizedAssigned, feesTotal, assigned: true, shares, purchasePrice: strike }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } else {
      // CC assigned: stock called away → close the underlying StockLot
      if (!stockLotId) {
        return new Response("CoveredCall has no linked StockLot to close", { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        const lot = await tx.stockLot.findUnique({
          where: { id: stockLotId },
          select: { shares: true, avgCost: true, realizedPnl: true },
        });

        await tx.trade.update({
          where: { id },
          data: {
            status: "closed",
            closedAt: now,
            closingPrice: 0,
            contractsOpen: 0,
            premiumCaptured: (trade.premiumCaptured ?? 0) + realizedAssigned,
            percentPL: 100,
            closeReason: "assigned",
            notes: trade.notes
              ? `${trade.notes}\nAssigned → stock called away @ $${strike}`
              : `Assigned → stock called away @ $${strike}`,
          },
        });

        // Only sell the shares covered by this CC (contractsToClose * 100)
        const assignedShares = contractsToClose * CONTRACT_MULTIPLIER;
        const lotShares = lot ? Number(lot.shares) : assignedShares;
        const lotAvgCost = lot ? Number(lot.avgCost) : 0;
        const stockRealizedPnl = (strike - lotAvgCost) * assignedShares;
        const remainingShares = lotShares - assignedShares;
        const accumulatedPnl = lot?.realizedPnl
          ? new Prisma.Decimal(lot.realizedPnl)
          : new Prisma.Decimal(0);
        const newRealizedPnl = accumulatedPnl.add(new Prisma.Decimal(stockRealizedPnl));

        await tx.stockLot.update({
          where: { id: stockLotId },
          data:
            remainingShares <= 0
              ? {
                  status: "CLOSED",
                  closedAt: now,
                  closePrice: new Prisma.Decimal(strike),
                  realizedPnl: newRealizedPnl,
                }
              : {
                  shares: remainingShares,
                  realizedPnl: newRealizedPnl,
                },
        });
      });

      return new Response(
        JSON.stringify({ realizedNow: realizedAssigned, feesTotal, assigned: true, shares, salePrice: strike }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  if (trade.status !== "open") {
    return new Response("Trade is not open", { status: 400 });
  }
  if (!Number.isFinite(trade.contractPrice)) {
    return new Response("Trade.contractPrice missing/invalid", { status: 400 });
  }
  if (!trade.contractsOpen || trade.contractsOpen < contractsToClose) {
    return new Response("contractsToClose exceeds open contracts", {
      status: 400,
    });
  }

  // --- CHANGED: correct P&L based on long vs short
  const openPrice = Number(trade.contractPrice); // price paid (long) or credit received (short)
  let gross: number;
  let percentPL: number;

  if (isShortOption(trade.type)) {
    // sold to open → buy to close
    // P&L = (credit_at_open - debit_to_close) * 100 * contracts
    gross = (openPrice - closingPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((openPrice - closingPrice) / openPrice) * 100 : 0;
  } else if (isLongOption(trade.type)) {
    // bought to open → sell to close
    // P&L = (credit_from_close - debit_at_open) * 100 * contracts
    gross = (closingPrice - openPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((closingPrice - openPrice) / openPrice) * 100 : 0;
  } else {
    // Fallback: treat as short to avoid silent mispricing; you can also choose to 400 here.
    gross = (openPrice - closingPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((openPrice - closingPrice) / openPrice) * 100 : 0;
  }

  const feesTotal = feesPerContract * contractsToClose + flatFees;
  // P&L before normalization (already long/short aware)
  let realizedNow = gross - feesTotal;

  // Normalize saved sign so profit > 0, loss < 0
  if (percentPL >= 0 && realizedNow < 0) {
    realizedNow = Math.abs(realizedNow);
  } else if (percentPL < 0 && realizedNow > 0) {
    realizedNow = -Math.abs(realizedNow);
  }

  const remaining = trade.contractsOpen - contractsToClose;
  const fullCloseFlag = body.fullClose;
  const isFull =
    typeof fullCloseFlag === "boolean" ? fullCloseFlag : remaining <= 0;

  const sellSharesPriceNum =
    body.sellSharesPrice != null && Number.isFinite(Number(body.sellSharesPrice))
      ? Number(body.sellSharesPrice)
      : null;
  const sharesToSellNum =
    body.sharesToSell != null && Number.isFinite(Number(body.sharesToSell))
      ? Math.round(Number(body.sharesToSell))
      : contractsToClose * CONTRACT_MULTIPLIER;

  if (isFull) {
    // FULL CLOSE: accumulate P&L and mark closed
    const newPremiumCaptured = (trade.premiumCaptured ?? 0) + realizedNow;

    await prisma.$transaction(async (tx) => {
      await tx.trade.update({
        where: { id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingPrice,
          contractsOpen: 0,
          premiumCaptured: newPremiumCaptured,
          percentPL,
          closeReason: closeReason ?? "manual",
        },
      });

      if (isCoveredCall && stockLotId) {
        // apply THIS close leg's realized premium to the underlying stock lot
        const realized = Number(realizedNow);
        if (Number.isFinite(realized) && realized !== 0) {
          const lot = await tx.stockLot.findUnique({
            where: { id: stockLotId },
            select: { shares: true, avgCost: true },
          });

          if (lot) {
            const sharesInt = Number(lot.shares);
            if (Number.isFinite(sharesInt) && sharesInt > 0) {
              const shares = new Prisma.Decimal(sharesInt);
              const avgCost = new Prisma.Decimal(lot.avgCost);
              const totalBasis = avgCost.mul(shares);
              const newTotalBasis = totalBasis.sub(new Prisma.Decimal(realized));
              const newAvgCost = newTotalBasis.div(shares);
              const safeAvgCost = Prisma.Decimal.max(newAvgCost, new Prisma.Decimal(0));

              await tx.stockLot.update({
                where: { id: stockLotId },
                data: { avgCost: safeAvgCost },
              });
            }
          }
        }

        // Optional: also sell shares from the lot in the same transaction.
        // We re-fetch the lot so the P&L uses the avgCost AFTER premium reduction above.
        if (sellSharesPriceNum != null && sellSharesPriceNum > 0) {
          const lotAfter = await tx.stockLot.findUnique({
            where: { id: stockLotId },
            select: {
              shares: true,
              avgCost: true,
              realizedPnl: true,
              status: true,
              trades: {
                where: { type: "CoveredCall", status: "open" },
                select: { contractsOpen: true },
              },
            },
          });

          if (lotAfter && lotAfter.status !== "CLOSED") {
            const lotSharesInt = Number(lotAfter.shares);
            // Shares still covered by OTHER open CCs on this lot
            const otherCcShares = lotAfter.trades.reduce(
              (sum, t) => sum + t.contractsOpen * 100,
              0,
            );
            const maxSellable = lotSharesInt - otherCcShares;
            const actualSell = Math.min(sharesToSellNum, maxSellable);

            if (actualSell > 0) {
              const lotAvgCost = new Prisma.Decimal(lotAfter.avgCost);
              const sellPrice = new Prisma.Decimal(sellSharesPriceNum);
              const shareRealizedNow = sellPrice
                .sub(lotAvgCost)
                .mul(new Prisma.Decimal(actualSell));
              const accumulated = lotAfter.realizedPnl
                ? new Prisma.Decimal(lotAfter.realizedPnl)
                : new Prisma.Decimal(0);
              const newRealizedPnl = accumulated.add(shareRealizedNow);
              const newShares = lotSharesInt - actualSell;

              await tx.stockLot.update({
                where: { id: stockLotId },
                data:
                  newShares <= 0
                    ? {
                        shares: 0,
                        status: "CLOSED",
                        closedAt: new Date(),
                        closePrice: sellPrice,
                        realizedPnl: newRealizedPnl,
                      }
                    : {
                        shares: newShares,
                        realizedPnl: newRealizedPnl,
                      },
              });
            }
          }
        }
      }
    });

    return new Response(JSON.stringify({ realizedNow, feesTotal }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // PARTIAL CLOSE:
    await prisma.$transaction(async (tx) => {
      await tx.trade.update({
        where: { id },
        data: {
          contractsOpen: remaining,
        },
      });

      await tx.trade.create({
        data: {
          ticker: trade.ticker,
          strikePrice: trade.strikePrice,
          expirationDate: trade.expirationDate,
          createdAt: trade.createdAt,
          type: trade.type,
          contracts: contractsToClose,
          contractsInitial: contractsToClose,
          contractsOpen: 0,
          contractPrice: openPrice,
          entryPrice: trade.entryPrice, // retained for display only
          portfolioId: trade.portfolioId,
          stockLotId: trade.stockLotId ?? null,
          status: "closed",
          closingPrice,
          premiumCaptured: realizedNow,
          percentPL,
          closeReason: closeReason ?? "manual",
          closedAt: new Date(),
        },
      });

      if (isCoveredCall && stockLotId) {
        const realized = Number(realizedNow);
        if (Number.isFinite(realized) && realized !== 0) {
          const lot = await tx.stockLot.findUnique({
            where: { id: stockLotId },
            select: { shares: true, avgCost: true },
          });

          if (lot) {
            const sharesInt = Number(lot.shares);
            if (Number.isFinite(sharesInt) && sharesInt > 0) {
              const shares = new Prisma.Decimal(sharesInt);
              const avgCost = new Prisma.Decimal(lot.avgCost);
              const totalBasis = avgCost.mul(shares);
              const newTotalBasis = totalBasis.sub(new Prisma.Decimal(realized));
              const newAvgCost = newTotalBasis.div(shares);
              const safeAvgCost = Prisma.Decimal.max(newAvgCost, new Prisma.Decimal(0));

              await tx.stockLot.update({
                where: { id: stockLotId },
                data: { avgCost: safeAvgCost },
              });
            }
          }
        }

        // Optional: also sell shares (same logic as full close path)
        if (sellSharesPriceNum != null && sellSharesPriceNum > 0) {
          const lotAfter = await tx.stockLot.findUnique({
            where: { id: stockLotId },
            select: {
              shares: true,
              avgCost: true,
              realizedPnl: true,
              status: true,
              trades: {
                where: { type: "CoveredCall", status: "open" },
                select: { contractsOpen: true },
              },
            },
          });

          if (lotAfter && lotAfter.status !== "CLOSED") {
            const lotSharesInt = Number(lotAfter.shares);
            const otherCcShares = lotAfter.trades.reduce(
              (sum, t) => sum + t.contractsOpen * 100,
              0,
            );
            const maxSellable = lotSharesInt - otherCcShares;
            const actualSell = Math.min(sharesToSellNum, maxSellable);

            if (actualSell > 0) {
              const lotAvgCost = new Prisma.Decimal(lotAfter.avgCost);
              const sellPrice = new Prisma.Decimal(sellSharesPriceNum);
              const shareRealizedNow = sellPrice
                .sub(lotAvgCost)
                .mul(new Prisma.Decimal(actualSell));
              const accumulated = lotAfter.realizedPnl
                ? new Prisma.Decimal(lotAfter.realizedPnl)
                : new Prisma.Decimal(0);
              const newRealizedPnl = accumulated.add(shareRealizedNow);
              const newShares = lotSharesInt - actualSell;

              await tx.stockLot.update({
                where: { id: stockLotId },
                data:
                  newShares <= 0
                    ? {
                        shares: 0,
                        status: "CLOSED",
                        closedAt: new Date(),
                        closePrice: sellPrice,
                        realizedPnl: newRealizedPnl,
                      }
                    : {
                        shares: newShares,
                        realizedPnl: newRealizedPnl,
                      },
              });
            }
          }
        }
      }
    });

    return new Response(JSON.stringify({ realizedNow, feesTotal, remaining }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Backward compatibility: allow POST to behave like PATCH
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  return PATCH(req, props);
}