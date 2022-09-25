import db from "../providers/Mysql";
import Subscription, { PatreonTierId } from "../structures/Subscription";
import { raw } from "mysql";
import Exception, { Severity } from "../utils/Exception";

export default class SubscriptionsManager {
  public static readonly SUBSCRIPTION_PERIOD_TERM: number = 2_678_399 * 1_000; // 30 day 23 hours 59 min 59 sec

  public async fetch(
    userId: string,
    tierId: PatreonTierId
  ): Promise<Subscription | null>;
  public async fetch(userId: string): Promise<Subscription[] | null>;
  public async fetch(
    activeOnly: boolean,
    tierId?: PatreonTierId
  ): Promise<Subscription[]>;
  public async fetch(
    input: string | boolean,
    tierId?: PatreonTierId
  ): Promise<Subscription | Subscription[] | null> {
    if (input === false)
      throw new Exception("Not implemented yet", Severity.SUSPICIOUS);

    const fetchType: "ALL_ACTIVE_SUBSCRIPTIONS" | "USER_SUBSCRIPTION" =
      typeof input === "boolean"
        ? "ALL_ACTIVE_SUBSCRIPTIONS"
        : "USER_SUBSCRIPTION";
    const tierFetchType: "ONE_TIER" | "ALL_TIERS" = tierId
      ? "ONE_TIER"
      : "ALL_TIERS";

    const where: { name: string; value?: any }[] = [];
    if (fetchType === "USER_SUBSCRIPTION")
      where.push({ name: "discordUserId = ?", value: input });

    if (tierFetchType === "ONE_TIER")
      where.push({ name: "tierId = ?", value: tierId });
    else
      where.push({
        name: "tierId in (?)",
        value: Object.values(PatreonTierId),
      });

    if (fetchType === "ALL_ACTIVE_SUBSCRIPTIONS")
      where.push({
        name: "unix_timestamp(createdAt) > unix_timestamp() - subscriptionPeriodTerm",
        value: undefined,
      });

    const raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, chargeStatus + 0 as chargeStatus, unix_timestamp(chargeDate) as chargeTimestamp, unix_timestamp(createdAt) as createdTimestamp, unix_timestamp(updatedAt) as updatedTimestamp, subscriptionPeriodTerm, userId, amountCents, discordUserId, email, tierId, BIN_TO_UUID(memberId) as memberId
               from \`Patreon.Pledges\` where discordUserId is not null
               ${
                 where.length > 0
                   ? "and  " + where.map((w) => w.name).join(" and ")
                   : ""
               }
           group by chargeDate, chargeStatus`,
      where.filter((w) => w.value != undefined).map((w) => w.value)
    );
    if (!raws?.length)
      return fetchType === "ALL_ACTIVE_SUBSCRIPTIONS" ? [] : null;
    const subscriptions = raws
      .filter(
        (raw, index) =>
          raws.map((raw) => raw.tierId).indexOf(raw.tierId) === index
      )
      .flatMap((raw) =>
        raws
          .filter(
            (r, index) =>
              raws.map((raw) => raw.discordUserId).indexOf(r.discordUserId) ===
              index
          )
          .flatMap((raw2) => {
            let a = raws.filter(
              (r) =>
                r.tierId === raw.tierId &&
                r.discordUserId === raw2.discordUserId
            );
            return a.length ? this.resolve(a) : [];
          })
      );

    return tierFetchType === "ONE_TIER" && fetchType === "USER_SUBSCRIPTION"
      ? subscriptions[0]
      : subscriptions;
  }

  private resolve(raws: any[]): Subscription {
    return new Subscription(
      raws[0].tierId,
      raws.map((raw) => ({
        id: raw.id,
        amountCents: raw.amountCents,
        subscriptionPeriodTermMs: Math.round(raw.subscriptionPeriodTerm * 1000),
        chargeDate: new Date(Math.round(raw.chargeTimestamp * 1000)),
        chargeStatus:
          raw.chargeStatus === 1
            ? "PAID"
            : raw.chargeStatus === 2
            ? "REFUND"
            : "UNKNOWN",
        eventCreatedAt: new Date(Math.round(raw.createdTimestamp * 1000)),
        eventUpdatedAt: new Date(Math.round(raw.updatedTimestamp * 1000)),
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
