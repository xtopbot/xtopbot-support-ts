import { Collection } from "discord.js";
import Ratelimit from "../structures/Ratelimit";

export default class RatelimitManager<T extends { id: string }> {
  public readonly timeWindowInMilliSeconds: number;
  public readonly capacityRate: number;
  private readonly cache: Collection<string, Ratelimit<T>> = new Collection();

  constructor(timeWindowInMilliSeconds: number, capacityRate: number) {
    this.timeWindowInMilliSeconds = timeWindowInMilliSeconds;
    this.capacityRate = capacityRate;
  }

  public get(d: T): Ratelimit<T> {
    const cached = this.cache.get(d.id);
    if (cached) return cached;
    const RL = new Ratelimit(d, this);
    this.cache.set(d.id, RL);
    return RL;
  }

  public isAllowed(d: T): boolean {
    return (
      this.cache.get(d.id)?.isAllowed() ??
      !!this.cache.set(d.id, new Ratelimit(d, this))
    );
  }
}
