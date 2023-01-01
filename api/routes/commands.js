import * as admin from "firebase-admin";
import { DB } from "+config";
import { util } from "+lib/util";
import IG from "+lib//node-ig-api/index.es6";
import stream from "../../lib/stream";

export default (router) => {
  router.get("/command", async (ctx) => {
    let upMarketCommands = {},
      upOptionCommands = {},
      downMarketCommands = {},
      downOptionCommands = {};
    const upMarketSubscription = await admin
      .firestore()
      .collection(DB.COLLECTION_COMMANDS)
      .doc(ctx.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("up")
      .collection(DB.COLLECTION_MARKET_THRESHOLDS)
      .get();

    upMarketSubscription.forEach((data) => {
      upMarketCommands[data.id] = upMarketCommands[data.id]
        ? upMarketCommands[data.id].concat(data.data().orders)
        : data.data().orders;
    });

    const upOptionSubscription = await admin
      .firestore()
      .collection(DB.COLLECTION_COMMANDS)
      .doc(ctx.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("up")
      .collection(DB.COLLECTION_OPTION_THRESHOLDS)
      .get();

    upOptionSubscription.forEach((data) => {
      upOptionCommands[data.id] = upOptionCommands[data.id]
        ? upOptionCommands[data.id].concat(data.data().orders)
        : data.data().orders;
    });

    const downMarketSubscription = await admin
      .firestore()
      .collection(DB.COLLECTION_COMMANDS)
      .doc(ctx.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("down")
      .collection(DB.COLLECTION_MARKET_THRESHOLDS)
      .get();

    downMarketSubscription.forEach((data) => {
      downMarketCommands[data.id] = downMarketCommands[data.id]
        ? downMarketCommands[data.id].concat(data.data().orders)
        : data.data().orders;
    });

    const downOptionSubscription = await admin
      .firestore()
      .collection(DB.COLLECTION_COMMANDS)
      .doc(ctx.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc("down")
      .collection(DB.COLLECTION_OPTION_THRESHOLDS)
      .get();

    downOptionSubscription.forEach((data) => {
      downOptionCommands[data.id] = downOptionCommands[data.id]
        ? downOptionCommands[data.id].concat(data.data().orders)
        : data.data().orders;
    });

    ctx.body = {
      up: {
        market: upMarketCommands,
        option: upOptionCommands,
      },
      down: {
        market: downMarketCommands,
        option: downOptionCommands,
      },
    };
  });

  router.post("/command", async (ctx) => {
    if (!util.isNumeric(ctx.request.body.threshold))
      throw Error("threshold can only be string number");
    if (!["up", "down"].includes(ctx.request.body.direction))
      throw Error("direction can only be up or down");
    if (!["market", "option"].includes(ctx.request.body.type))
      throw Error("type can only be market or option");

    let res = null;
    const db = admin.firestore();
    const isOptionOrder = ctx.request.body.type === "option" ? true : false;
    const getType = () => {
      if (!isOptionOrder) {
        return DB.COLLECTION_MARKET_THRESHOLDS;
      }
      return DB.COLLECTION_OPTION_THRESHOLDS;
    };
    const ref = await db
      .collection(DB.COLLECTION_COMMANDS)
      .doc(ctx.tokens.IG_IDENTIFIER)
      .collection(DB.COLLECTION_DIRECTIONS)
      .doc(ctx.request.body.direction)
      .collection(getType())
      .doc(ctx.request.body.threshold + "-" + ctx.request.body.epic)
      .get();

    if (ref.exists) {
      res = await db
        .collection(DB.COLLECTION_COMMANDS)
        .doc(ctx.tokens.IG_IDENTIFIER)
        .collection(DB.COLLECTION_DIRECTIONS)
        .doc(ctx.request.body.direction)
        .collection(getType())
        .doc(ctx.request.body.threshold + "-" + ctx.request.body.epic)
        .update({
          orders: admin.firestore.FieldValue.arrayUnion(ctx.request.body.order),
        });
    } else {
      res = await db
        .collection(DB.COLLECTION_COMMANDS)
        .doc(ctx.tokens.IG_IDENTIFIER)
        .collection(DB.COLLECTION_DIRECTIONS)
        .doc(ctx.request.body.direction)
        .collection(getType())
        .doc(ctx.request.body.threshold + "-" + ctx.request.body.epic)
        .set({
          orders: admin.firestore.FieldValue.arrayUnion(ctx.request.body.order),
        });
    }

    await stream
      .getInstance(ctx.tokens)
      .createSubsription(ctx.request.body.epic);

    ctx.body = res;
  });

  router.delete("/command", async (ctx) => {
    if (!["market", "option"].includes(ctx.request.body.type))
      throw Error("type can only be market or option");

    const res = await stream
      .getInstance(ctx.tokens)
      .deleteCommand(
        ctx.request.body.direction,
        ctx.request.body.type,
        ctx.request.body.threshold + "-" + ctx.request.body.epic
      );
    ctx.body = res;
  });

  router.get("/command/workingorder", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.showWorkingOrders();
  });

  router.post("/command/workingorder", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.createOrder(ctx.request.body);
  });

  router.del("/command/workingorder", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.deleteAllOrders();
  });

  router.del("/command/workingorder/:dealId", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.deleteOrder(ctx.params.dealId);
  });

  router.post("/command/deal", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.deal(ctx.request.body);
  });

  router.put("/command/deal/:dealId", async (ctx) => {
    const ig = new IG(ctx.tokens);
    ctx.body = await ig.editPosition(ctx.params.dealId, ctx.request.body);
  });

  router.post("/command/gambleStats", async (ctx) => {
    const ig = new IG(ctx.tokens);
    const epicDetail = await ig.epicDetail(ctx.request.body.epic);
    const { bid, offer } = epicDetail.snapshot;
    const buyOrder = {
      currencyCode: ctx.request.body.currencyCode,
      direction: "BUY",
      epic: ctx.request.body.epic,
      expiry: "-",
      forceOpen: true,
      guaranteedStop: true,
      level: bid + ctx.request.body.distance,
      limitDistance: ctx.request.body.limitDistance,
      size: ctx.request.body.size,
      stopDistance: ctx.request.body.stopDistance,
      timeInForce: "GOOD_TILL_CANCELLED",
      type: "STOP",
    };

    const sellOrder = {
      currencyCode: ctx.request.body.currencyCode,
      direction: "SELL",
      epic: ctx.request.body.epic,
      expiry: "-",
      forceOpen: true,
      guaranteedStop: true,
      level: offer - ctx.request.body.distance,
      limitDistance: ctx.request.body.limitDistance,
      size: ctx.request.body.size,
      stopDistance: ctx.request.body.stopDistance,
      timeInForce: "GOOD_TILL_CANCELLED",
      type: "STOP",
    };

    let buyOrder$ = ig.createOrder(buyOrder);
    let sellOrder$ = ig.createOrder(sellOrder);

    ctx.body = await Promise.all([buyOrder$, sellOrder$]);
  });
};
