import IG from "./node-ig-api/index.es6";
import Stat from "./stat";
import firebase from "./firebase";
import R from "ramda";
import * as dateFns from "date-fns";
import * as admin from "firebase-admin";
import { DB } from "+config";
import cron from "node-cron";
import util from "util";
import chalk from "chalk";
import services from "../modules/services";
import GridStrategy from "./strategy/grid";

const StreamUserList = {};
const StreamUserListWithoutCST = {};
class Stream {
  constructor(tokens) {
    this.ig = IG.getInstance(tokens);
    this.tokens = tokens;
    this.subscriptions = [];
    this.warnings = {};
    this.strategy = {};
    this.cron = null;
    this.db = firebase;
    this.commands = {
      up: {
        market: {},
        option: {},
        grid: {},
      },
      down: {
        market: {},
        option: {},
        grid: {},
      },
    };
  }

  static getInstance(tokens) {
    // return new Stream(tokens);
    if (tokens["IG_CST"]) {
      if (StreamUserList[tokens.IG_IDENTIFIER]) {
        return StreamUserList[tokens.IG_IDENTIFIER];
      } else {
        StreamUserList[tokens.IG_IDENTIFIER] = new Stream(tokens);
        return StreamUserList[tokens.IG_IDENTIFIER];
      }
    } else {
      if (StreamUserListWithoutCST[tokens.IG_IDENTIFIER]) {
        return StreamUserListWithoutCST[tokens.IG_IDENTIFIER];
      } else {
        StreamUserListWithoutCST[tokens.IG_IDENTIFIER] = new Stream(tokens);
        return StreamUserListWithoutCST[tokens.IG_IDENTIFIER];
      }
    }
  }

  async init() {
    this.ig.disconnectToLightstreamer();
    this.initWarnings();
    this.initCommands();
    this.initStrategy();
    this.streaming();
    if (this.cron) this.cron.stop();
    this.cron = cron.schedule("59 */5 * * *", async () => {
      this.ig.disconnectToLightstreamer();
      await this.ig.login(true, this.tokens);
      const newTokens = await this.ig.getToken();
      this.ig = IG.getInstance(JSON.parse(newTokens.token));
      this.tokens = JSON.parse(newTokens.token);
      this.streaming();
    });
  }

  async initToken() {
    const iG = IG.getInstance(this.tokens);
    await iG.login(true, this.tokens);
  }

  initStrategy() {
    this.db
      .collection(DB.COLLECTION_GRID_STRATEGY)
      .doc(this.tokens.IG_IDENTIFIER)
      .onSnapshot((querySnapshot) => {
        this.strategy[this.tokens.IG_IDENTIFIER] = {};
        const strategy = querySnapshot.data();
        if (strategy) {
          for (let [k, v] of Object.entries(strategy)) {
            console.log("STRATEGY: " + chalk.yellow(k), " => ", v);
            this.strategy[this.tokens.IG_IDENTIFIER][k] = v;
          }
        }
      });
  }

  initCommands() {
    this.db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(this.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("down")
      .collection(DB.COLLECTION_MARKET_THRESHOLDS)
      .onSnapshot((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          // doc.data() is never undefined for query doc snapshots
          console.log(
            "DOWN MARKET COMMANDS: " + doc.id,
            " => ",
            doc.data().orders
          );
          this.commands["down"]["market"][doc.id] = doc.data().orders;
        });
      });

    this.db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(this.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("down")
      .collection(DB.COLLECTION_OPTION_THRESHOLDS)
      .onSnapshot((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          // doc.data() is never undefined for query doc snapshots
          console.log(
            "DOWN OPTION COMMANDS: " + doc.id,
            " => ",
            doc.data().orders
          );
          this.commands["down"]["option"][doc.id] = doc.data().orders;
        });
      });

    this.db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(this.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("up")
      .collection(DB.COLLECTION_MARKET_THRESHOLDS)
      .onSnapshot((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          // doc.data() is never undefined for query doc snapshots
          console.log(
            "UP MARKET COMMANDS: " + doc.id,
            " => ",
            doc.data().orders
          );
          this.commands["up"]["market"][doc.id] = doc.data().orders;
        });
      });

    this.db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(this.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("up")
      .collection(DB.COLLECTION_OPTION_THRESHOLDS)
      .onSnapshot((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          // doc.data() is never undefined for query doc snapshots
          console.log(
            "UP OPTION COMMANDS: " + doc.id,
            " => ",
            doc.data().orders
          );
          this.commands["up"]["option"][doc.id] = doc.data().orders;
        });
      });
  }

  initWarnings() {
    this.db
      .collection(DB.COLLECTION_WARNINGS)
      .doc(this.tokens.IG_IDENTIFIER)
      .onSnapshot((querySnapshot) => {
        const warnings = querySnapshot.data();
        if (warnings) {
          for (let [k, v] of Object.entries(warnings)) {
            console.log("WARNINGS: " + chalk.yellow(k), " => ", v);
            this.warnings[k] = v;
          }
        }
      });
  }

  dataProcessing(data) {
    try {
      this.monitorWarnings(data);
      this.monitorCommands(data);
    } catch (e) {
      console.error(e);
    }
  }

  monitorCommands(subscription) {
    if (subscription[5] === "TRADEABLE") {
      const epic = subscription[1];
      const type = epic.startsWith("OP") ? "option" : "market";
      if (this.subscriptions && this.subscriptions.includes(epic)) {
        // const currentPrice = parseFloat(
        //   (parseFloat(subscription[2]) + parseFloat(subscription[3])) / 2
        // ).toFixed(2);
        const currentPrice = parseFloat(subscription[2]);

        // if (process.env.NODE_ENV === "demo") {
        //   console.log(
        //     chalk.red(
        //       `************   CHECK ${this.tokens.IG_IDENTIFIER} Commands Subscription   ************`
        //     )
        //   );
        //   console.log(this.warnings);
        //   console.log(this.commands);
        //   console.log(this.subscriptions);
        //   console.log(
        //     chalk.red(
        //       `************ CHECK ${this.tokens.IG_IDENTIFIER} Commands Subscription END ************\r\n`
        //     )
        //   );
        // }
        this.checkAndSendCommand("up", currentPrice, type, epic);
        this.checkAndSendCommand("down", currentPrice, type, epic);
        this.checkStrategy(currentPrice, epic);
      }
    } else {
      console.log(
        chalk.bold.red(
          "MARKET IS NOT TRADEABLE AT THE MOMENT FOR EPIC: " + subscription[1]
        )
      );
    }
  }

  async checkStrategy(currentPrice, epic) {
    if (
      this.strategy[this.tokens.IG_IDENTIFIER] &&
      this.strategy[this.tokens.IG_IDENTIFIER][epic] &&
      this.strategy[this.tokens.IG_IDENTIFIER][epic]["profitLimit"] &&
      this.strategy[this.tokens.IG_IDENTIFIER][epic]["stopLoss"]
    ) {
      if (
        this.strategy[this.tokens.IG_IDENTIFIER][epic]["direction"] === "short"
      ) {
        if (
          currentPrice <=
          this.strategy[this.tokens.IG_IDENTIFIER][epic]["profitLimit"]
        ) {
          console.log("[Profit] Close strategy " + epic);
          //Take profit
          new GridStrategy(this.tokens).closeStrategy(epic);

          services
            .getNotifier()
            .send(
              `Strategy: ${epic} profit taken, now it is closing all orders`
            );
        } else if (
          currentPrice >=
          this.strategy[this.tokens.IG_IDENTIFIER][epic]["stopLoss"]
        ) {
          console.log("[Loss] Close strategy " + epic);
          //Stop loss
          new GridStrategy(this.tokens).closeStrategy(epic);
          services
            .getNotifier()
            .send(`Strategy: ${epic} stops loss, now it is closing all orders`);
        }
      } else if (
        this.strategy[this.tokens.IG_IDENTIFIER][epic]["direction"] === "long"
      ) {
        if (
          currentPrice >=
          this.strategy[this.tokens.IG_IDENTIFIER][epic]["profitLimit"]
        ) {
          console.log("[Profit] Close strategy " + epic);
          //Take profit
          new GridStrategy(this.tokens).closeStrategy(epic);
          services
            .getNotifier()
            .send(
              `Strategy: ${epic} profit taken, now it is closing all orders`
            );
        } else if (
          currentPrice <=
          this.strategy[this.tokens.IG_IDENTIFIER][epic]["stopLoss"]
        ) {
          console.log("[Loss] Close strategy " + epic);
          //Stop loss
          new GridStrategy(this.tokens).closeStrategy(epic);
          services
            .getNotifier()
            .send(`Strategy: ${epic} stops loss, now it is closing all orders`);
        }
      }
    }
  }

  async checkAndSendCommand(direction, currentPrice, type, epic) {
    for (let [i, v] of Object.entries(this.commands[direction][type])) {
      const [threshold, dbEpic] = i.split("-");
      if (dbEpic === epic) {
        if (currentPrice < threshold && direction === "down") {
          console.log(`满足down ${type}条件: ` + i);
          for (let o of v) {
            this.deleteCommandInMemory("down", i, type, o);
            await this.executeCommand(o);
            // this.deleteSubscription(epic);
          }
          await this.deleteCommand("down", type, i);
        } else if (currentPrice > threshold && direction === "up") {
          console.log(`满足up ${type}条件: ` + i);
          for (let o of v) {
            this.deleteCommandInMemory("up", i, type, o);
            await this.executeCommand(o);
          }
          await this.deleteCommand("up", type, i);
          // this.deleteSubscription(epic);
        }
      }
    }
  }

  executeCommand(order) {
    return new Promise((resolve, reject) => {
      if (order.orderType == "MARKET") {
        this.ig
          .deal(order)
          .then((response) => {
            console.log(
              "Market Command executed: " +
                +util.inspect(order, { depth: null }) +
                "\n Reseponse: " +
                util.inspect(response, { depth: null })
            );
            resolve(true);
          })
          .catch((err) => {
            console.error(
              "Market Command failed: " +
                util.inspect(order, { depth: null }) +
                "\n Reseponse: " +
                util.inspect(err, { depth: null })
            );
            reject(false);
          });
      } else if (order.orderType == "QUOTE") {
        this.ig
          .createOption(order)
          .then((response) => {
            console.log(
              "Quote Command executed: " +
                util.inspect(order, { depth: null }) +
                "\n Reseponse: " +
                util.inspect(response, { depth: null })
            );
            resolve(true);
          })
          .catch((err) => {
            console.error(
              "Quote Command failed: " +
                util.inspect(order, { depth: null }) +
                "\n Reseponse: " +
                util.inspect(err, { depth: null })
            );
            reject(false);
          });
      } else if (order.orderType == "GRID") {
        console.info("Start grid strategy " + order.epic);
        new GridStrategy(this.tokens, order).startStrategy();
        resolve(true);
      } else {
        resolve(true);
      }
    });
  }

  async deleteSubscription(epic) {
    const data = await this.db
      .collection(DB.COLLECTION_SUBSCRIPTIONS)
      .doc(this.tokens.IG_IDENTIFIER)
      .update({
        epics: admin.firestore.FieldValue.arrayRemove(epic),
      });

    this.reConnectToStream();
    return data;
  }

  monitorWarnings(subscription) {
    const epic = subscription[1];
    // const currentPrice = parseFloat(
    //   (parseFloat(subscription[2]) + parseFloat(subscription[3])) / 2
    // ).toFixed(2);

    const currentPrice = parseFloat(subscription[2]);
    // if (process.env.NODE_ENV === "demo") {
    //   console.log("-------------------------------------------------------");
    //   console.log(subscription);
    //   console.log(
    //     chalk.blueBright("Epic: " + subscription[1] + " : " + currentPrice)
    //   );
    // }
    Stat.getInstance(this.tokens.IG_IDENTIFIER).record(subscription);
    if (this.warnings[epic]) {
      if (currentPrice < this.warnings[epic]["lowerBound"]) {
        console.log("hit lowerbound");
        const newLowerBound =
          this.warnings[epic]["lowerBound"] - this.warnings[epic]["step"];
        const newUpperBound =
          this.warnings[epic]["upperBound"] - this.warnings[epic]["step"];
        services
          .getNotifier()
          .send(
            `Current ${epic} price is reaching lower bound: ${this.warnings[epic]["lowerBound"]}. Next warning message will be sent out if down ${newLowerBound} or up ${newUpperBound}`
          );
        this.updateWarning(epic, newLowerBound, newUpperBound);
      } else if (currentPrice > this.warnings[epic]["upperBound"]) {
        console.log("hit upperbound");
        const newLowerBound =
          this.warnings[epic]["lowerBound"] + this.warnings[epic]["step"];
        const newUpperBound =
          this.warnings[epic]["upperBound"] + this.warnings[epic]["step"];
        services
          .getNotifier()
          .send(
            `Current ${epic} price is reaching upper bound: ${this.warnings[epic]["upperBound"]}. Next warning message will be sent out if down ${newLowerBound} or up ${newUpperBound}`
          );
        this.updateWarning(epic, newLowerBound, newUpperBound);
      } else {
        // In safe position
      }
    }
  }

  updateWarning(epic, lowerBound, upperBound) {
    this.warnings[epic]["lowerBound"] = lowerBound;
    this.warnings[epic]["upperBound"] = upperBound;
    this.db
      .collection(DB.COLLECTION_WARNINGS)
      .doc(this.tokens.IG_IDENTIFIER)
      .set({ [epic]: { lowerBound, upperBound } }, { merge: true });
  }

  deleteCommandInMemory(direction, threshold, type, order) {
    this.commands[direction][type][threshold] = this.commands[direction][type][
      threshold
    ].filter((d) => !R.equals(order)(d));
  }

  async deleteCommand(direction, type, threshold) {
    const dbCollection =
      type === "option"
        ? DB.COLLECTION_OPTION_THRESHOLDS
        : DB.COLLECTION_MARKET_THRESHOLDS;
    delete this.commands[direction][type][threshold];
    const res = await this.db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(this.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc(direction)
      .collection(dbCollection)
      .doc(threshold)
      .delete();

    console.log(
      `Commands for ${direction}:${dbCollection}:${threshold} has been cleared`
    );
    return res;
  }

  async streaming() {
    console.log("Streaming...");
    this.acountStream();
    this.tradeStream();
    await this.getSubscriptions();
    if (this.subscriptions) {
      this.marketStream();
    }
  }

  marketStream() {
    const subs = R.compose(R.map((d) => "MARKET:" + d))(this.subscriptions);
    if (subs.length <= 0) {
      return Error("No subscription yet");
    }
    var str = [];
    var subscriptionMode = "MERGE";
    var items = subs;
    var fields = ["BID", "OFFER", "CHANGE_PCT", "MARKET_STATE", "CHANGE"];

    this.ig.connectToLightstreamer({ mode: subscriptionMode });
    this.ig.subscribeToLightstreamer(subscriptionMode, items, fields, 1, {
      onSubscription: () => {
        console.log("Subscribed to: " + items);
      },
      onUnsubscription: function () {
        console.log("Unsubscribed");
      },

      onSubscriptionError: (code, message) => {
        console.log("Subscription failure: " + code + " message: " + message);
      },

      onItemLostUpdates: () => {
        console.log("Update item lost");
      },

      onItemUpdate: (updateInfo) => {
        str.push(dateFns.format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"));

        str.push(updateInfo.getItemName().split(":")[1]); // epic without 'L1:'

        updateInfo.forEachField((fieldName, fieldPos, value) => {
          str.push(value);
        });

        this.dataProcessing(str);
        //str.push(os.EOL);
        // console.log(str.join(','));
        str = [];
      },
    });
  }

  acountStream() {}

  tradeStream() {
    var subscriptionMode = "DISTINCT";
    var items = `TRADE:${this.tokens.IG_CURRENT_ACCT_ID}`;
    var fields = ["CONFIRMS", "OPU", "WOU"];

    this.ig.connectToLightstreamer({ mode: subscriptionMode });
    this.ig.subscribeToLightstreamer(subscriptionMode, items, fields, 1, {
      onSubscription: () => {
        console.log("Subscribed to: " + items);
      },
      onUnsubscription: function () {
        console.log("Unsubscribed");
      },

      onSubscriptionError: (code, message) => {
        console.log("Subscription failure: " + code + " message: " + message);
      },

      onItemLostUpdates: () => {
        console.log("Update item lost");
      },

      onItemUpdate: (updateInfo) => {
        var dealOrder = updateInfo.getValue("OPU");
        dealOrder = JSON.parse(dealOrder);
        if (this.strategy[this.tokens.IG_IDENTIFIER][dealOrder.epic]) {
          this.processDealOrder(dealOrder);
        }
      },
    });
  }

  async processDealOrder(dealOrder) {
    /* 
      Deleted order
      {
        "dealReference": "ZQKCN27RSMUTYM9",
        "dealId": "DIAAAAH2V7DHWAP",
        "direction": "SELL",
        "epic": "IX.D.NASDAQ.IFA.IP",
        "status": "DELETED",
        "dealStatus": "ACCEPTED",
        "level": 15110,
        "size": 10,
        "timestamp": "2022-04-04T15:30:35.822",
        "channel": "PublicRestOTC",
        "expiry": "-",
        "currency": "AUD",
        "stopDistance": null,
        "limitDistance": null,
        "guaranteedStop": false,
        "orderType": "LIMIT",
        "timeInForce": "GOOD_TILL_CANCELLED",
        "goodTillDate": null
      }
      Open order
      {
        "dealReference": "9CRXRJV9GD4TYM9",
        "dealId": "DIAAAAH2V7N74A6",
        "direction": "BUY",
        "epic": "IX.D.NASDAQ.IFA.IP",
        "status": "OPEN",
        "dealStatus": "ACCEPTED",
        "level": 15090,
        "size": 10,
        "timestamp": "2022-04-04T15:38:34.266",
        "channel": "OSAutoStopFill",
        "dealIdOrigin": "DIAAAAH2V7N74A6",
        "expiry": "-",
        "stopLevel": null,
        "limitLevel": null,
        "guaranteedStop": false
      }
    */
    const dealEpic = dealOrder?.epic;
    if (
      this.strategy[this.tokens.IG_IDENTIFIER] &&
      this.strategy[this.tokens.IG_IDENTIFIER][dealEpic] &&
      dealOrder?.dealStatus === "ACCEPTED" &&
      ((dealOrder?.status === "OPEN" &&
        dealOrder?.channel === "OSAutoStopFill") ||
        (dealOrder?.status === "UPDATED" &&
          dealOrder?.channel === "PublicRestOTC")) &&
      dealOrder?.size !== 0
    ) {
      const step =
        (this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].high -
          this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].low) /
        this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].numOfGrids;
      let orderToCreate = null;
      if (dealOrder.direction === "SELL") {
        orderToCreate = {
          currencyCode:
            this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].currencyCode,
          direction: dealOrder?.status === "UPDATED" ? "SELL" : "BUY",
          epic: this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].epic,
          expiry: "-",
          forceOpen: false,
          guaranteedStop: false,
          level:
            dealOrder?.status === "UPDATED"
              ? dealOrder.level + step
              : dealOrder.level - step,
          limitDistance: null,
          size: this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].size,
          stopDistance: null,
          timeInForce: "GOOD_TILL_CANCELLED",
          type: "LIMIT",
        };
      } else if (dealOrder.direction === "BUY") {
        orderToCreate = {
          currencyCode:
            this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].currencyCode,
          direction: dealOrder?.status === "UPDATED" ? "BUY" : "SELL",
          epic: this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].epic,
          expiry: "-",
          forceOpen: false,
          guaranteedStop: false,
          level:
            dealOrder?.status === "UPDATED"
              ? dealOrder.level - step
              : dealOrder.level + step,
          limitDistance: null,
          size: this.strategy[this.tokens.IG_IDENTIFIER][dealEpic].size,
          stopDistance: null,
          timeInForce: "GOOD_TILL_CANCELLED",
          type: "LIMIT",
        };
      }
      try {
        await this.ig.createOrder(orderToCreate);
      } catch (e) {
        console.log(e);
      }
    }
  }

  async reConnectToStream() {
    try {
      this.ig.disconnectToLightstreamer();
      this.streaming();
    } catch (e) {
      console.error(e);
    }
  }

  async disconnectToLightstreamer() {
    this.ig.disconnectToLightstreamer();
  }

  async createSubsription(epic) {
    let res = null;
    const sub = epic;
    const docSnapShot = await this.db
      .collection(DB.COLLECTION_SUBSCRIPTIONS)
      .doc(this.tokens.IG_IDENTIFIER)
      .get();
    const epics = R.path(["epics"])(docSnapShot.data());
    if (R.isNil(epics) || R.isEmpty(epics)) {
      res = await this.db
        .collection(DB.COLLECTION_SUBSCRIPTIONS)
        .doc(this.tokens.IG_IDENTIFIER)
        .set({
          epics: [sub],
        });
      this.subscriptions = [sub];
      this.reConnectToStream();
      return res;
    } else {
      if (epics.includes(sub)) {
        return `EPIC: ${epic} already exists`;
      } else {
        res = await this.db
          .collection(DB.COLLECTION_SUBSCRIPTIONS)
          .doc(this.tokens.IG_IDENTIFIER)
          .set({
            epics: R.concat([sub])(epics),
          });
        this.subscriptions = R.concat([sub])(epics);
        this.reConnectToStream();
        return res;
      }
    }
  }

  async getSubscriptions() {
    const subscription = await this.db
      .collection(DB.COLLECTION_SUBSCRIPTIONS)
      .doc(this.tokens.IG_IDENTIFIER)
      .get();
    this.subscriptions = R.path(["epics"])(subscription.data());
    return this.subscriptions;
  }
}

export default Stream;
