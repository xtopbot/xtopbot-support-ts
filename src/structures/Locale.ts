export default class Locale {
  setSync(arg0: boolean) {
    throw new Error("Method not implemented.");
  }
  public data: any;
  constructor(data: any) {
    this.data = data;
  }

  get id(): string {
    return this.data.folder;
  }

  get flag(): string {
    return this.data.folder;
  }

  public _patch(data: any): void {
    this.data = data;
  }

  public get tags(): Array<string> {
    return [];
  }
}
