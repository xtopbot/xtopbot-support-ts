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
    const paidSubscriptions = this.events.filter(
      (event) => event.chargeStatus === "PAID"
    );
    const refundSubscriptions = this.events.filter(
      (event) => event.chargeStatus === "REFUND"
    );
    const paidAmountCents =
      paidSubscriptions
        .map((sub) => sub.amountCents)
        .reduce((a, b) => a + b, 0) -
      refundSubscriptions
        .map((sub) => sub.amountCents)
        .reduce((a, b) => a + b, 0);
    return cents ? paidAmountCents : (paidAmountCents / 100).toFixed(2);
  }

  public getExpires(): Date {
    return new Date(
      this.events
        .filter((event) => event.chargeStatus === "PAID")
        .map(() => SubscriptionsManager.SUBSCRIPTION_PERIOD_TERM)
        .reduce((a, b) => a + b, 0) -
        this.events
          .filter((event) => event.chargeStatus === "REFUND")
          .map(() => SubscriptionsManager.SUBSCRIPTION_PERIOD_TERM)
          .reduce((a, b) => a + b, 0) +
        (this.events
          .find(
            (event) =>
              event.eventCreatedAt.getTime() +
                SubscriptionsManager.SUBSCRIPTION_PERIOD_TERM >
              Date.now()
          )
          ?.eventCreatedAt.getTime() ??
          this.getLastEvent("PAID").eventCreatedAt.getTime())
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
  eventCreatedAt: Date;
}
