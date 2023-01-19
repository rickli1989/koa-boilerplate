import PrismaService from "./PrismaService";
import * as jwt from "jsonwebtoken";
import { User } from "@prisma/client";
import * as Boom from "@hapi/boom";
import { Context } from "koa";
import * as argon from "argon2";
export class UserService {
  static instance: UserService;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async createUser(data: { email: string; hash: string }): Promise<User> {
    const user = await PrismaService.user.create({
      data: {
        email: data.email,
        hash: data.hash,
      },
    });

    return user;
  }

  async findUser(ctx: Context): Promise<User> {
    const user = await PrismaService.user.findUnique({
      where: {
        email: ctx.request.body.email,
      },
    });
    // if user does not exist throw exception
    if (!user) throw Boom.unauthorized("User does not exist");

    // compare password
    const pwMatches: boolean = await argon.verify(
      user.hash,
      ctx.request.body.password
    );
    // if password incorrect throw exception
    if (!pwMatches) throw Boom.unauthorized("Credentials incorrect");

    return user;
  }

  async signToken(
    userId: number,
    email: string
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };

    const token = await jwt.sign(payload, process.env.JWT_SECRET_KEY!, {
      expiresIn: process.env.JWT_EXPIRE_TIME,
    });

    return {
      access_token: token,
    };
  }
}

export default UserService.getInstance();
