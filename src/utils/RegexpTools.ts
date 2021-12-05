export default class RegexpTools {
  public static escape(input: string): string {
    return input.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  }
}
