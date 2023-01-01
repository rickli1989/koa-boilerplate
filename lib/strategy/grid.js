import { LEVERAGE, DB } from "+/config";
import firebase from "../firebase";
import * as admin from "firebase-admin";
import IG from "../node-ig-api/index.es6";
import stream from "../stream";
import R from "ramda";

export default class GridStrategy {
  constructor(tokens, params = null) {
    this.ig = IG.getInstance(tokens);
    this.tokens = tokens;
    this.streamInstance = stream.getInstance(tokens);
    this.params = params;
    this.db = firebase;
    this.PROFIT_PERCENT = this.params?.profit_percentage || 0.7;
  }

  getName() {
    return "grid";
  }

  async closeStrategy(epic) {
    try {
      admin
        .firestore()
        .collection(DB.COLLECTION_GRID_STRATEGY)
        .doc(this.tokens.IG_IDENTIFIER)
        .set(
          {
            [epic]: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
      const position = await this.ig.showOpenPositions();
      const orderIds = R.compose(
        R.map(R.path(["position", "dealId"])),
        R.filter(R.pathEq(["market", "epic"], epic))
      )(position.positions);
      for (let orderId of orderIds) {
        await this.ig.closePosition(orderId);
      }
      const workingOrders = await this.ig.showWorkingOrders();
      const workingOrderIds = R.compose(
        R.map(R.prop("dealId")),
        R.filter((d) => d.epic === epic),
        R.map(R.prop("workingOrderData"))
      )(workingOrders.workingOrders);
      if (workingOrderIds.length > 0) this.ig.deleteAllOrders(workingOrderIds);
    } catch (e) {
      console.error(e);
    }
  }

  async startStrategy() {
    try {
      const { direction, epic } = this.params;
      const epicDetail = await this.getCurrentEpicPrice(epic);
      const { bid, offer } = epicDetail.snapshot;
      const currentPrice = direction === "long" ? offer : bid;
      const orderRequest = this.getGridOrders(currentPrice, epic);
      const [newOrders, limitDistance, stopDistance] =
        await this.createCurrentOrder(
          orderRequest,
          direction,
          epic,
          currentPrice
        );
      this.saveStrategy(limitDistance, stopDistance);
      this.createWorkingOrders(newOrders);
      // const orderResponse = await this.createWorkingOrders(newOrders);
      // const zipResponse = R.compose(
      //   R.map((d) => ({
      //     request: d[0],
      //     response: d[1],
      //   })),
      //   R.zip(newOrders)
      // )(orderResponse);
      // admin
      //   .firestore()
      //   .collection(DB.COLLECTION_ORDERS)
      //   .doc(this.tokens.IG_IDENTIFIER)
      //   .set(
      //     {
      //       [this.params.epic]: zipResponse,
      //     },
      //     { merge: true }
      //   );

      return newOrders;
    } catch (err) {
      console.error(err);
    }
  }

  async getCurrentEpicPrice(epic) {
    return await this.ig.epicDetail(epic);
  }

  async createWorkingOrders(workingOrders) {
    const orders$ = [];
    for (let order of workingOrders) {
      orders$.push(this.ig.createOrder(order));
    }

    return await Promise.allSettled(orders$);
  }

  /*
    "currencyCode": "AUD",
    "direction": "BUY",
    "epic": "IX.D.DAX.IFA.IP",
    "expiry": "-",
    "forceOpen": false,
    "goodTillDate": null,
    "guaranteedStop": false,
    "level": 15700,
    "limitDistance": 50,
    "size": 1,
    "stopDistance": null,
    "timeInForce": "GOOD_TILL_CANCELLED",
    "type": "LIMIT"
  */
  getGridOrders(currentPrice = null, epic) {
    const step = (this.params.high - this.params.low) / this.params.numOfGrids;
    // const size = this.params.totalAmount / step;
    const ordersArr = [];
    const numOfTopGrids =
      this.params.direction === "short"
        ? Math.round(this.params.numOfGrids * (1 - this.params.percentage))
        : Math.round(this.params.numOfGrids * this.params.percentage);

    for (let i = 1; i <= numOfTopGrids; i++) {
      ordersArr.push({
        currencyCode: this.params.currencyCode ?? "AUD",
        direction: this.getDirection(
          this.params.direction,
          i * step + currentPrice,
          currentPrice
        ),
        epic: epic,
        expiry: "-",
        forceOpen: false,
        goodTillDate: null,
        guaranteedStop: false,
        level: i * step + currentPrice,
        limitDistance: null,
        size: this.params.size,
        stopDistance: null,
        timeInForce: "GOOD_TILL_CANCELLED",
        type: "LIMIT",
      });
    }

    for (let i = 1; i <= this.params.numOfGrids - numOfTopGrids; i++) {
      ordersArr.push({
        currencyCode: this.params.currencyCode ?? "AUD",
        direction: this.getDirection(
          this.params.direction,
          currentPrice - i * step,
          currentPrice
        ),
        epic: epic,
        expiry: "-",
        forceOpen: false,
        goodTillDate: null,
        guaranteedStop: false,
        level: currentPrice - i * step,
        limitDistance: null,
        size: this.params.size,
        stopDistance: null,
        timeInForce: "GOOD_TILL_CANCELLED",
        type: "LIMIT",
      });
    }

    return ordersArr.sort(
      (a, b) =>
        this.getDistanceToCurrentPrice(a, currentPrice) -
        this.getDistanceToCurrentPrice(b, currentPrice)
    );
  }

  getDistanceToCurrentPrice(order, currentPrice) {
    return Math.abs(order.level - currentPrice);
  }

  async createCurrentOrder(orders, direction, epic, currentPrice) {
    const tempOrders = [...orders];
    let body = {
      currencyCode: this.params.currencyCode ?? "AUD",
      guaranteedStop: false,
      level: null,
      epic: epic,
      limitDistance: null,
      orderType: "MARKET",
      stopDistance: null,
      timeInForce: "EXECUTE_AND_ELIMINATE",
      trailingStop: false,
      trailingStopIncrement: null,
      expiry: "-",
      forceOpen: true,
    };
    const step = (this.params.high - this.params.low) / this.params.numOfGrids;
    if (direction === "short") {
      const size = tempOrders.filter((o) => o.direction === "BUY").length;
      const newOrders = tempOrders.sort((a, b) => b.level - a.level);
      body.direction = "SELL";
      body.size = size * this.params.size;
      body.limitDistance = size * step * this.PROFIT_PERCENT;
      body.stopDistance = this.getStopLoss(newOrders) - currentPrice;
      await this.ig.deal(body);
      return [
        newOrders,
        currentPrice - body.limitDistance,
        currentPrice + body.stopDistance,
      ];
    } else {
      const size = tempOrders.filter((o) => o.direction === "SELL").length;
      const newOrders = tempOrders.sort((a, b) => a.level - b.level);
      body.direction = "BUY";
      body.size = size * this.params.size;
      body.limitDistance = size * step * this.PROFIT_PERCENT;
      body.stopDistance = currentPrice - this.getStopLoss(newOrders);
      await this.ig.deal(body);
      return [
        newOrders,
        currentPrice + body.limitDistance,
        currentPrice - body.stopDistance,
      ];
    }
  }

  getDirection(direction, i, currentPrice) {
    if (direction === "long") {
      return i < currentPrice ? "BUY" : "SELL";
    } else if (direction === "short") {
      return i > currentPrice ? "SELL" : "BUY";
    }
  }

  getStopLoss(orders) {
    return orders[0]["level"];
  }

  async saveStrategy(limitDistance, stopDistance) {
    this.params.profitLimit = limitDistance;
    this.params.stopLoss = stopDistance;
    admin
      .firestore()
      .collection(DB.COLLECTION_GRID_STRATEGY)
      .doc(this.tokens.IG_IDENTIFIER)
      .set(
        {
          [this.params.epic]: this.params,
        },
        { merge: true }
      );
  }
}
