import db from "../providers/Mysql";
import Subscription, { PatreonTierId } from "../structures/Subscription";
import { raw } from "mysql";

export default class SubscriptionsManager {
  public static readonly SUBSCRIPTION_PERIOD_TERM: number = 2_678_399 * 1_000; // 30 day 23 hours 59 min 59 sec

  public async fetch(
    userId: string,
    tierId: PatreonTierId
  ): Promise<Subscription | null>;
  public async fetch(userId: string): Promise<Subscription[] | null>;
  public async fetch(
    userId: string,
    tierId?: PatreonTierId
  ): Promise<Subscription | Subscription[] | null> {
    const fetchType: "ONE_TIER" | "ALL_TIERS" = tierId
      ? "ONE_TIER"
      : "ALL_TIERS";

    const raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, chargeStatus + 0 as chargeStatus, unix_timestamp(chargeDate) as chargeTimestamp, unix_timestamp(createdAt) as createdTimestamp, userId, amountCents, discordUserId, email, tierId, BIN_TO_UUID(memberId) as memberId from \`Patreon.Pledges\` where discordUserId = ? ${
        fetchType === "ONE_TIER" ? " and tierId = ?" : ""
      } group by chargeDate, chargeStatus`,
      [userId, tierId]
    );
    if (!raws?.length) return null;

    console.log(raws);

    const subscriptions = raws
      .filter(
        (raw, index) =>
          raws.map((raw) => raw.tierId).indexOf(raw.tierId) === index
      )
      .map((raw) => this.resolve(raws.filter((r) => r.tierId === raw.tierId)));

    return fetchType === "ONE_TIER" ? subscriptions[0] : subscriptions;
  }

  private resolve(raws: any[]): Subscription {
    return new Subscription(
      raws[0].tierId,
      raws.map((raw) => ({
        id: raw.id,
        amountCents: raw.amountCents,
        chargeDate: new Date(Math.round(raw.chargeTimestamp * 1000)),
        chargeStatus:
          raw.chargeStatus === 1
            ? "PAID"
            : raw.chargeStatus === 2
            ? "REFUND"
            : "UNKNOWN",
        eventCreatedAt: new Date(Math.round(raw.createdTimestamp * 1000)),
      })),
      {
        email: raws[0].email,
        userId: raws[0].userId,
        memberId: raws[0].memberId,
      },
      raws[0].discordUserId
    );
  }
}
