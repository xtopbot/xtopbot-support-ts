import en_US from "../locales/en-US/en-US.json";
import { LocaleTag } from "../managers/LocaleManager";

export default class Locale {
  public _data;

  constructor(data: any) {
    this._data = data;
  }

  public _patch(data: any): void {
    this._data = data;
  }

  public get origin() {
    return Object.assign(en_US, { ...this._data } as unknown);
  }

  public get id(): string {
    return this._data.folder;
  }

  public get tag(): LocaleTag {
    return this._data.folder;
  }

  public get tags(): Array<string> {
    return this.origin.tags;
  }
}
