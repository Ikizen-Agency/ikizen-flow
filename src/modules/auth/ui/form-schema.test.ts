import { describe, expect, it } from "vitest";
import { registerSchema, signInSchema } from "./form-schema";

describe("signInSchema", () => {
  it("normalises the email and requires a password", () => {
    expect(signInSchema.parse({ email: " Alex@Northstar.Studio ", password: "secret" }).email).toBe("alex@northstar.studio");
    expect(signInSchema.safeParse({ email: "nope", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = { name: "Jamie Rivera", email: "jamie@helix.dev", password: "long-enough", workspaceName: "Helix Ops" };

  it("accepts a complete registration", () => {
    expect(registerSchema.parse(valid)).toEqual(valid);
  });

  it("reports every invalid field", () => {
    const result = registerSchema.safeParse({ name: "", email: "x", password: "short", workspaceName: " " });
    expect(result.success).toBe(false);
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["email", "name", "password", "workspaceName"]);
  });
});
