import Collection from "@discordjs/collection";
export default class {
  protected _cache: Collection<string, any>;
  protected constructor() {
    this._cache = new Collection();
    //setInterval(() => this._cache.clear(), 60 * 60 * 1000); // 1hour;
  }

  protected _add(data: any): any {
    const cached: any = this._cache.get(data?.id);
    if (cached) {
      cached._patch(data);
      return cached;
    }
    this._cache.set(data.id, data);
    return data;
  }
}
