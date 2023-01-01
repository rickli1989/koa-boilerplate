import stream from "+lib/stream";

export default (router) => {
  router.del("/stream", async (ctx) => {
    await stream.getInstance(ctx.tokens).disconnectToLightstreamer();
    ctx.body = {
      msg: "Streaming finish",
    };
  });

  router.post("/stream", async (ctx) => {
    stream.getInstance(ctx.tokens).init();
    ctx.body = {
      msg: "Streaming Start",
    };
  });
};
