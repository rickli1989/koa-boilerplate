import Router from "@koa/router";
import { Context } from "koa";
import * as argon from "argon2";
import UserService from "../../lib/Prisma/UserService";
import { User } from "@prisma/client";
import { HttpStatusCode } from "axios";

export default (router: Router) => {
  router.post("/signup", async (ctx: Context) => {
    // save the new user in the db
    const hashPassword = await argon.hash(ctx.request.body.password);
    const user = await UserService.createUser({
      email: ctx.request.body.email,
      hash: hashPassword,
    });
    const { ["hash"]: hash, ...userWithoutHash } = user;
    ctx.status = HttpStatusCode.Created;
    ctx.body = userWithoutHash;
  });

  router.post("/signin", async (ctx: Context) => {
    // find the user by email
    const user: User = await UserService.findUser(ctx);

    ctx.body = await UserService.signToken(user.id, user.email);
  });
};
