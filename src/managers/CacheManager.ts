import Collection from "@discordjs/collection";
export default class CacheManager<T extends CacheMangerType> {
  public cache: Collection<string, T>;
  protected constructor() {
    this.cache = new Collection();
    //setInterval(() => this._cache.clear(), 60 * 60 * 1000); // 1hour;
  }

  protected _add(data: T): T {
    const cached = this.cache.get(data.id);
    if (cached && typeof cached?._patch === "function") {
      cached._patch(data);
      return cached;
    }
    this.cache.set(data.id, data);
    return data;
  }
}
interface CacheMangerType {
  id: string;
  _patch?(data: any): void;
}
