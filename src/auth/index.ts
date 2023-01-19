import * as passport from "koa-passport";
import * as compose from "koa-compose";

const importDir = require("directory-import");
const strategies = importDir("./strategies");

Object.keys(strategies).forEach((name) => {
  if (!name.endsWith("index.ts")) {
    passport.use(
      name.split("/").slice(-1).pop()!.split(".").shift()!,
      strategies[name].default
    );
  }
});

export default function auth() {
  return compose([passport.initialize()]);
}

export function isJwtAuthenticated() {
  return passport.authenticate("jwt", { session: false, failWithError: true });
}
