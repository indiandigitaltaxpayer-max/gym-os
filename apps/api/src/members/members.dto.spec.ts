import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateMemberDto } from "./members.dto";

describe("CreateMemberDto measurements", () => {
  const base = {
    branchId: "branch-1",
    firstName: "Asha",
    lastName: "Rao",
    phone: "+91 99999 00000",
  };

  it("accepts M/F gender and valid metric measurements", async () => {
    const dto = plainToInstance(CreateMemberDto, { ...base, gender: "F", heightCm: "165", weightKg: "58.5" });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual(expect.objectContaining({ gender: "F", heightCm: 165, weightKg: 58.5 }));
  });

  it("rejects free-text gender and out-of-range measurements", async () => {
    const dto = plainToInstance(CreateMemberDto, { ...base, gender: "Female", heightCm: "20", weightKg: "900" });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["gender", "heightCm", "weightKg"]));
  });
});
