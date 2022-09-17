import SubscriptionsManager from "../managers/SubscriptionsManager";
import Util from "../utils/Util";

export default class Subscription {
  public readonly tierId: PatreonTierId;
  public readonly events: SubscriptionEvent[];
  public readonly patreon: Patreon;
  public readonly discordUserId: string;
  constructor(
    tierId: PatreonTierId,
    events: SubscriptionEvent[],
    patreon: Patreon,
    discordUserId: string
  ) {
    this.tierId = tierId;
    this.events = events;
    this.patreon = patreon;
    this.discordUserId = discordUserId;
  }

  public getTotalPaidAmount(cents: false): string;
  public getTotalPaidAmount(cents: true): number;
  public getTotalPaidAmount(cents: boolean = false): string | number {
    const paidAmountCents = this.events
      .filter((event) => event.chargeStatus === "PAID")
      .map((sub) => sub.amountCents)
      .reduce((a, b) => a + b, 0);
    return cents ? paidAmountCents : (paidAmountCents / 100).toFixed(2);
  }

  public getExpires(): Date {
    const activePaidSubscription = this.events.filter(
      (event) =>
        event.eventCreatedAt.getTime() + event.subscriptionPeriodTermMs >
          Date.now() && event.chargeStatus === "PAID"
    );
    const lastPaid = this.getLastEvent("PAID");
    const lastPaidExpiredTimestamp = lastPaid
      ? lastPaid.eventCreatedAt.getTime() + lastPaid.subscriptionPeriodTermMs
      : 0;
    const lastRefundExpiredTimestamp =
      this.getLastEvent("REFUND")?.eventUpdatedAt.getTime() ?? 0;
    return new Date(
      activePaidSubscription
        .map((event) => event.subscriptionPeriodTermMs)
        .reduce((a, b) => a + b, 0) +
        (activePaidSubscription[0]?.eventCreatedAt.getTime() ??
          (lastRefundExpiredTimestamp > lastPaidExpiredTimestamp
            ? lastRefundExpiredTimestamp
            : lastPaidExpiredTimestamp))
    );
  }

  public getTierName(): string {
    return Util.capitalize(
      Object.keys(PatreonTierId)
        [Object.values(PatreonTierId).indexOf(this.tierId)].replace(/_/g, " ")
        .toLowerCase(),
      true
    );
  }

  public getLastEvent(status: "PAID" | "REFUND"): SubscriptionEvent {
    return this.events
      .filter((e) => e.chargeStatus === status)
      .sort(
        (a, b) => b.eventCreatedAt.getTime() - a.eventCreatedAt.getTime()
      )[0];
  }

  public getCreatedAt(): Date {
    return this.events.sort(
      (a, b) => a.eventCreatedAt.getTime() - b.eventCreatedAt.getTime()
    )[0].eventCreatedAt;
  }

  public isActive(): boolean {
    return this.getExpires().getTime() > Date.now();
  }
}

export enum PatreonTierId {
  ONE_CUSTOM_BOT = "7764503",
}

interface Patreon {
  userId: string;
  memberId: string;
  email: string;
}

interface SubscriptionEvent {
  id: string;
  chargeStatus: "PAID" | "REFUND" | "UNKNOWN";
  chargeDate: Date;
  amountCents: number;
  subscriptionPeriodTermMs: number;
  eventCreatedAt: Date;
  eventUpdatedAt: Date;
}
