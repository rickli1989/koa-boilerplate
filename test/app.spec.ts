import * as pactum from "pactum";
import server from "../src/app";

describe("App e2e", () => {
  let app: any;

  beforeAll(async () => {
    app = await server.listen(3001);

    pactum.request.setBaseUrl("http://localhost:3001/api");
  });

  afterAll(() => {
    app.close();
  });

  describe("App", () => {
    it("should running", (): any => {
      return pactum.spec().get("/ping").expectStatus(200);
    });
  });

  describe("Auth", () => {
    const user = {
      email: "rick@gmail.com",
      password: "123",
    };
    describe("Signup", () => {
      it("should throw if email empty", (): any => {
        return pactum
          .spec()
          .post("/signup")
          .withBody({
            // email: user.password,
            password: user.password,
          })
          .expectStatus(400);
      });
      it("should throw if password empty", (): any => {
        return pactum
          .spec()
          .post("/signup")
          .withBody({
            email: user.email,
          })
          .expectStatus(400);
      });

      it("should throw if no body provided", (): any => {
        return pactum.spec().post("/signup").expectStatus(400);
      });

      it("should signup success", (): any => {
        return pactum.spec().post("/signup").withBody(user).expectStatus(201);
      });

      it("should signup fail for duplicated email", (): any => {
        return pactum.spec().post("/signup").withBody(user).expectStatus(400);
      });
    });

    describe("Signin", () => {
      it("should throw if email empty", (): any => {
        return pactum
          .spec()
          .post("/signin")
          .withBody({
            password: user.password,
          })
          .expectStatus(400);
      });
      it("should throw if password empty", (): any => {
        return pactum
          .spec()
          .post("/signin")
          .withBody({
            email: user.email,
          })
          .expectStatus(400);
      });

      it("should get user not found", (): any => {
        return pactum
          .spec()
          .post("/signin")
          .withBody({
            email: "user",
            password: "password",
          })
          .expectBodyContains("User does not exist")
          .expectStatus(401);
      });

      it("should throw if password is wrong", (): any => {
        return pactum
          .spec()
          .post("/signin")
          .withBody({
            email: user.email,
            password: "wrong",
          })
          .expectStatus(401);
      });
      it("should signin", (): any => {
        return pactum
          .spec()
          .post("/signin")
          .withBody(user)
          .expectStatus(200)
          .stores("userAt", "access_token");
      });
    });
  });
});
