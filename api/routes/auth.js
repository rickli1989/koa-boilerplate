"use strict";

export default (router) => {
  router.post("/auth/login", async (ctx) => {
    ctx.body = "Login Success";
  });
};
