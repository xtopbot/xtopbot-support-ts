export default class Locale {
  private data: any;
  constructor(data: any) {
    this.data = data;
  }

  public _patch(data: any): void {
    this.data = data;
  }

  public get tags(): Array<string> {
    return [];
  }
}
