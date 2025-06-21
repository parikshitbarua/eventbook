import request from "supertest";
import app from "../src/app";

describe("App", () => {
  it("should be defined", () => {
    expect(app).toBeDefined();
  });

  it("should be an Express app", () => {
    expect(app.listen).toBeDefined();
  });

  describe("GET /", () => {
    it("should return 200 and welcome message", async () => {
      const response = await request(app).get("/").expect("Content-Type", /json/).expect(200);

      expect(response.body).toEqual({
        message: "Boilerplate code for ExpressJS + TS"
      });
    });
  });

  describe("Error Handler", () => {
    it("should handle errors properly", async () => {
      app.get("/error", (req, res, next) => {
        console.log("Error route hit, throwing error...");
        next(new Error("Test error"));
      });

      await request(app).get("/error").expect(500);
    });
  });
});
