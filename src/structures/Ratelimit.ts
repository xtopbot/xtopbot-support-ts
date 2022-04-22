import { Collection } from "discord.js";
import RatelimitManager from "../managers/RatelimitManager";

export default class Ratelimit<T extends { id: string }> {
  public data: T;
  private readonly manager: RatelimitManager<T>;
  private readonly _requests: Collection<Date, null> = new Collection();
  public rateLimitReached: Date | null = null;
  public blockedEndAt: Date | null = null;
  public blockedCount: number = 0;
  constructor(data: T, manager: RatelimitManager<T>) {
    this.data = data;
    this.manager = manager;
  }

  public get id(): string {
    return this.data.id;
  }

  //The origin number of requests that can be made
  public get limit(): number {
    return this.manager.capacityRate;
  }

  public get remaining(): number {
    return (
      Math.ceil(
        this.manager.capacityRate -
          this.requests.filter(
            (v, k) =>
              k.getTime() >= Date.now() - this.manager.timeWindowInMilliSeconds
          ).size
      ) ?? 0
    );
  }

  public get requests() {
    this._requests
      .filter(
        (v, k) =>
          k.getTime() < Date.now() - this.manager.timeWindowInMilliSeconds
      )
      .forEach((v, k) => this._requests.delete(k));
    return this._requests;
  }

  public isAllowed(): boolean {
    if (this.blockedEndAt && this.blockedEndAt.getTime() > Date.now())
      return false;
    if (this.remaining > 0) {
      this.requests.set(new Date(), null);
      return true;
    }
    this.rateLimitReached = new Date();
    this.blockedEndAt = new Date();
    const blockedTime =
      this.requests
        .map((_v, k) =>
          this.requests.find(
            (_v, k2) =>
              k.getTime() > k2.getTime() - 1000 &&
              k.getTime() < k2.getTime() + 1000 &&
              k !== k2
          ) === null
            ? 2
            : 1
        )
        .reduce((a, b) => a + b, 0) *
      Math.round(
        this.manager.timeWindowInMilliSeconds / (this.manager.capacityRate / 2)
      );
    this.blockedCount++;
    this.blockedEndAt.setTime(
      Date.now() +
        Math.min(
          blockedTime * Math.min(this.blockedCount, 5),
          1000 * 60 * 60 * 24 * 28 /*Max Blocked*/
        )
    );
    return false;
  }
}
