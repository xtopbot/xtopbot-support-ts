import SubscriptionsManager from "../managers/SubscriptionsManager";

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

  public getPaidAmount(cents: false): string;
  public getPaidAmount(cents: true): number;
  public getPaidAmount(cents: boolean = false): string | number {
    const paidSubscriptions = this.events.filter(
      (event) => event.chargeStatus === "PAID"
    );
    const refundSubscriptions = this.events.filter(
      (event) => event.chargeStatus === "REFUND"
    );
    const paidAmountCents =
      paidSubscriptions.map((sub) => sub.amountCents).reduce((a, b) => a + b) -
      refundSubscriptions.map((sub) => sub.amountCents).reduce((a, b) => a + b);
    return cents ? paidAmountCents : paidAmountCents.toFixed();
  }

  public getExpires(): Date {
    return new Date(
      this.events
        .filter((event) => event.chargeStatus === "PAID")
        .map(() => SubscriptionsManager.SUBSCRIPTION_PERIOD_TERM)
        .reduce((a, b) => a + b) -
        this.events
          .filter((event) => event.chargeStatus === "REFUND")
          .map(() => SubscriptionsManager.SUBSCRIPTION_PERIOD_TERM)
          .reduce((a, b) => a + b) +
        Date.now()
    );
  }

  public getTierName(): string {
    return Object.keys(PatreonTierId)[
      Object.values(PatreonTierId).indexOf(this.tierId)
    ];
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
