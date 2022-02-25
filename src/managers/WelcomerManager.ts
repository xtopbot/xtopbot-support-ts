import { Collection, Message } from "discord.js";
import CacheManager from "./CacheManager";
export default class WelcomerManager extends CacheManager {
  constructor() {
    super();
  }

  public get cache(): Collection<string, Message> {
    return this._cache;
  }
}
