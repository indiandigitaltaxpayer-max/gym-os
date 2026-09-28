import { randomUUID } from "node:crypto";

export type ProviderMessage = { recipientAddress: string; body: string; simulateFailure?: boolean };
export type ProviderResult = { provider: string; providerMessageId: string; delivered: boolean };

export interface NotificationProvider {
  send(message: ProviderMessage): Promise<ProviderResult>;
}

export class SimulatedNotificationProvider implements NotificationProvider {
  async send(message: ProviderMessage): Promise<ProviderResult> {
    if (message.simulateFailure || message.recipientAddress.toLowerCase().includes("fail")) {
      throw Object.assign(new Error("Simulated provider rejection"), { code: "SIMULATED_FAILURE" });
    }
    return { provider: "simulated", providerMessageId: `sim_${randomUUID()}`, delivered: true };
  }
}
