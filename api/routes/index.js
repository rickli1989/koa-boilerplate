"use strict";

export default (router) => {
  router.get("/health/ping", async (ctx) => {
    ctx.body = {
      status: "online",
      version: "1.0",
    };
  });
};
