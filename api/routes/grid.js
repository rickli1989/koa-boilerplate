import GridStrategy from "../../lib/strategy/grid";
import stream from "../../lib/stream";

export default (router) => {
  router.post("/grid", async (ctx) => {
    await stream
      .getInstance(ctx.tokens)
      .createSubsription(ctx.request.body.epic);
    const gridStrategy = new GridStrategy(ctx.tokens, ctx.request.body);
    const orders = await gridStrategy.startStrategy();
    ctx.body = orders;
  });

  router.del("/grid", async (ctx) => {
    const epic = ctx.request.body.epic;

    const gridStrategy = new GridStrategy(ctx.tokens);
    await gridStrategy.closeStrategy(epic);
    ctx.body = "Success";
  });
};
