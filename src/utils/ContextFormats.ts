import { Collection } from "discord.js";
import Response, { AnyResponse } from "./Response";

export default class ContextFormats {
  public readonly formats: Collection<string, string> = new Collection();

  public setObject(keyOrigin: string, input: Object): void {
    for (let [key, value] of Object.entries({ ...input })) {
      let _key = keyOrigin + "." + key;
      if (typeof value == "object" && value !== null)
        this.setObject(_key, value);
      else if (typeof value == "string" || typeof value == "number")
        this.formats.set(_key, String(value));
      else if (typeof value == "boolean")
        this.formats.set(_key, value ? "True" : "False");
      else this.formats.set(_key, "(Unknown format)");
    }
  }

  public resolve(response: Response<AnyResponse> | any): any {
    return this.resolveObject(response.message || response);
  }

  private resolveObject(input: any): any {
    if (typeof input == "string") return this.resolveString(input);
    if (typeof input !== "object") return input;
    if (Array.isArray(input))
      return input.map((_input) =>
        typeof _input == "object"
          ? this.resolveObject(_input)
          : typeof _input == "string"
          ? this.resolveString(_input)
          : _input
      );
    let obj = { ...input };
    for (let [key, value] of Object.entries(obj)) {
      obj[key] =
        typeof value == "object"
          ? this.resolveObject(value)
          : typeof value == "string"
          ? this.resolveString(value)
          : value;
    }
    return obj;
  }

  private get RegexFormats(): RegExp {
    return new RegExp(
      this.formats
        .map((_value, key) =>
          `{{${key}}}`.replace(
            /\[|\]|\^|\*|\{|\}|\(|\)|\./gi,
            (match) => `\\${match}`
          )
        )
        .join("|"),
      "gi"
    );
  }

  private resolveString(input: string): string {
    return input.replace(this.RegexFormats, (match) => {
      return this.formats.get(match.slice(2, -2)) ?? match ?? "";
    });
  }
}
