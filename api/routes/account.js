"use strict";
import IG from "+lib/node-ig-api/index.es6";
import calculator from "+lib/calculator";
import R from "ramda";

export default (router) => {
  router.get("/account", async (ctx) => {
    const result = await calculator.calcAccountPosition(ctx.tokens);
    ctx.body = result;
  });

  router.get("/account/position", async (ctx) => {
    const position = await IG.getInstance(ctx.tokens).showOpenPositions();
    ctx.body = R.compose(
      R.map(R.path(["position", "dealId"])),
      R.filter(R.pathEq(["market", "epic"], ctx.query.epic))
    )(position.positions);
  });

  router.get("/position", async (ctx) => {
    const position = await IG.getInstance(ctx.tokens).showOpenPositions();
    const currentMonthPositons = calculator.getCurrentMonthPositions(
      position.positions
    );
    ctx.body = currentMonthPositons;
  });
};
