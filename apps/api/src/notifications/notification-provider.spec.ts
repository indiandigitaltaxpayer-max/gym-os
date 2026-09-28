import { SimulatedNotificationProvider } from "./notification-provider";

describe("SimulatedNotificationProvider", () => {
  it("returns a delivered provider reference", async () => {
    const provider = new SimulatedNotificationProvider();
    await expect(provider.send({ recipientAddress: "9999999999", body: "Hello" })).resolves.toMatchObject({ provider: "simulated", delivered: true, providerMessageId: expect.stringMatching(/^sim_/) });
  });

  it("can produce a deterministic provider failure", async () => {
    const provider = new SimulatedNotificationProvider();
    await expect(provider.send({ recipientAddress: "9999999999", body: "Hello", simulateFailure: true })).rejects.toMatchObject({ code: "SIMULATED_FAILURE" });
  });
});
