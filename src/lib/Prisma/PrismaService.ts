import { PrismaClient, UnwrapTuple } from "@prisma/client";

class PrismaService extends PrismaClient {
  static instance: PrismaService;

  constructor() {
    super({
      datasources: {
        db: {
          // url: process.env.DATABASE_URL,
        },
      },
    });
  }

  static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  cleanDb(): Promise<UnwrapTuple<any>> {
    return this.$transaction([this.image.deleteMany(), this.user.deleteMany()]);
  }
}

export default PrismaService.getInstance();
