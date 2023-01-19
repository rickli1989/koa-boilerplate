"use strict";
import { Strategy, ExtractJwt } from "passport-jwt";

const opts: any = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.JWT_SECRET_KEY;

export default new Strategy(opts, async (user, done) => {
  try {
    return done(null, user);
  } catch (error) {
    return done(error);
  }
});
