import { EPIC } from "+config";
import IG from "+lib/node-ig-api/index.es6";
const R = require("ramda");
const Boom = require("@hapi/boom");
let instance = null;
class Calculator {
  constructor() {
    if (!instance) {
      instance = this;
    }
    return instance;
  }

  async calcAccountPosition(tokens) {
    const p = await IG.getInstance(tokens).showOpenPositions();
    const filteredPositions = R.filter(
      R.compose(R.startsWith("OP"), R.path(["market", "epic"]))
    )(p.positions);
    const accounts = await IG.getInstance(tokens).acctInfo();
    let cfdAccount = null;
    if (process.env.NODE_ENV === "prod")
      cfdAccount = accounts.accounts.find((d) => d.accountName === "CFD");
    else cfdAccount = accounts.accounts.find((d) => d.accountType === "CFD");
    if (filteredPositions.length === 0) {
      return cfdAccount.balance;
      // 	throw Boom.notFound("You haven't created any DAX options yet");
    }
    const currentMonthPositions =
      this.getCurrentMonthPositions(filteredPositions);
    const currentEURAUD = await IG.getInstance(tokens).epicDetail(EPIC.EURAUD);
    const currentPrice =
      (currentEURAUD.snapshot.bid + currentEURAUD.snapshot.offer) / 2;
    const totalProfit = currentMonthPositions.reduce(
      (accumulated, current) =>
        accumulated +
        current.position.contractSize *
          current.position.dealSize *
          current.position.openLevel,
      0
    );
    const res = this.calculatePosition(
      currentMonthPositions,
      currentPrice,
      totalProfit,
      cfdAccount.balance
    );
    return Object.assign(
      {},
      cfdAccount.balance,
      {
        maxProfit: R.compose(
          R.apply(Math.max, R.__),
          R.map((d) => R.compose(R.prop("profit"), R.head(), R.values())(d))
        )(res.profits),
      },
      res
    );
  }

  calculatePosition(pos, rate, totalProfit, balance) {
    const res = R.compose(
      R.groupBy(R.prop("instrumentName")),
      R.sortBy(R.prop("dealSize")),
      R.map((d) => ({
        dealSize: R.path(["position", "dealSize"])(d),
        openLevel: R.path(["position", "openLevel"])(d),
        contractSize: R.path(["position", "contractSize"])(d),
        direction: R.compose(
          R.ifElse(
            (data) => data.includes("漲") || data.includes("long"),
            (data) => R.identity("buy"),
            (data) => R.identity("sell")
          ),
          R.nth(2),
          R.split(" "),
          R.path(["market", "instrumentName"])
        )(d),
        instrumentName: R.compose(
          parseInt,
          R.nth(1),
          R.split(" "),
          R.path(["market", "instrumentName"])
        )(d),
      }))
    )(pos);
    // console.log(res);
    const keys = R.compose(R.map(parseInt), R.keys)(res);

    const midValue = this.getMidValue(res);

    console.log("MidValue: " + midValue);

    const leftBound = keys[0],
      rightBound = keys[keys.length - 1];

    const priceRange = this.getPriceRange(leftBound, rightBound);
    return {
      positions: res,
      profits: R.map((d) => {
        const stopProfit = this.calcProfit(d, midValue, rate, totalProfit, res);
        return {
          [d]: {
            profit: stopProfit,
            totalBalance: Math.round(stopProfit + balance.balance),
          },
        };
      })(priceRange),
    };
  }

  getMidValue(data) {
    let left = 0,
      right = 999999999;
    for (let [k, v] of Object.entries(data)) {
      if (v[0]["direction"] === "sell") {
        left = k;
      } else {
        right = k;
        break;
      }
    }
    console.log("left: " + left, "right: " + right);
    return (parseInt(left) + parseInt(right)) / 2;
  }

  getPriceRange(left, right, gap = 50) {
    return Array((right - left) / gap + 1)
      .fill()
      .map((_, idx) => parseInt(left) + idx * gap);
  }

  calcProfit(stopPos, midValue, rate, totalProfit, data) {
    // console.log(stopPos, midValue, rate, totalProfit, R.keys(data));
    let profit = totalProfit;
    for (let i of R.keys(data)) {
      i = parseInt(i);
      if (i < midValue) {
        //下方位
        if (stopPos >= i) {
          //吃满
          // console.log("下方吃满 " + i);
        } else {
          //亏损
          const diffGap = Math.abs(i - stopPos);
          const acturalLoss = this.calcLoss(diffGap, data[i]);
          const originProfit = this.calcOriginProfit(data[i]);
          // console.log("下方亏损 " + i + " " + acturalLoss);
          profit = profit + acturalLoss - originProfit;
        }
      } else {
        // 上方位
        if (stopPos <= i) {
          //吃满
          // console.log("上方吃满 " + i);
        } else {
          //亏损
          const diffGap = Math.abs(i - stopPos);
          const acturalLoss = this.calcLoss(diffGap, data[i]);
          const originProfit = this.calcOriginProfit(data[i]);
          // console.log("上方亏损 " + i + " " + acturalLoss);
          profit = profit + acturalLoss - originProfit;
        }
      }
    }
    return Math.round(profit * rate);
  }

  calcLoss(diffGap, positions) {
    let loss = 0;
    for (let pos of positions) {
      loss += (pos.openLevel - diffGap) * pos.dealSize * pos.contractSize;
    }
    return loss;
  }

  calcOriginProfit(positions) {
    let profit = 0;
    for (let pos of positions) {
      profit += pos.openLevel * pos.dealSize * pos.contractSize;
    }
    return profit;
  }

  getCurrentMonthPositions(positions) {
    const groups = R.compose(R.groupBy(R.path(["market", "expiry"])))(
      positions
    );
    const notCurrentMonths = [];
    let max = groups[R.keys(groups)[0]].length;
    for (let month of R.keys(groups)) {
      if (groups[month].length >= max) {
        max = groups[month].length;
      } else {
        notCurrentMonths.push(month);
      }
    }
    return positions.filter((d) => !notCurrentMonths.includes(d.market.expiry));
  }
}

export default new Calculator();
