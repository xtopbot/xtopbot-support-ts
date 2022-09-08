import { ButtonStyle, ComponentType, PermissionsString } from "discord.js";
import Exception, { Severity } from "./Exception";
import { MessageResponse } from "./Response";
import ContextFormats from "./ContextFormats";
import Locale from "../structures/Locale";

export default class Util {
  public static backButton(locale: Locale, customId: string) {
    return {
      type: ComponentType.Button,
      label: locale.origin.backButton,
      style: ButtonStyle.Secondary,
      customId: customId,
      emoji: {
        name: "left_arrow",
        id: "1017280123587805244",
      },
    };
  }

  public static getUUIDLowTime(uuid: string) {
    return uuid.substring(0, 8);
  }

  public static capitalize(value: string, eachWord = false): string {
    const arr = eachWord ? value.split(" ") : [value];
    return arr.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" ");
  }

  public static permissionsToStringArray(
    permissions: Array<PermissionsString>
  ): Array<string> {
    return permissions.map((permission) =>
      permission
        .replace(/guild/gi, "Server")
        .split(/(?=[A-Z])/)
        .map((_p) => _p.charAt(0).toUpperCase() + _p.toLowerCase().slice(1))
        .join(" ")
    );
  }

  public static escapeRegex(input: string): string {
    return input.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  public static textEllipsis(str: string, truncate: number): string {
    return str.length > truncate ? str.substring(0, truncate - 3) + "..." : str;
  }

  public static stringToJson(value: string): JSON | null {
    return JSON.parse(value).catch(() => null);
  }

  public static addFieldToEmbed(
    message: MessageResponse,
    embedIndex: number,
    name: string,
    value: any
  ): any {
    const newMessage = { ...message };
    const embed = newMessage.embeds?.[embedIndex];
    if (!embed)
      throw new Exception(
        `Index ${embedIndex} embed not found.`,
        Severity.SUSPICIOUS
      );
    (embed as any)[name] = value;
    return newMessage;
  }

  public static isUUID(value: any): boolean {
    return typeof value === "string" && value.length === 36;
  }

  public static selectMenuPages(length: number) {
    const defaultLastIndex = 23;

    const result: {
      lastIndex: number;
      firstIndex: number;
      result: number;
      page: number;
    }[] = [];

    for (let page = 1; page < Infinity; page++) {
      /**
       * First page must be show 24. if there next page must show 23.
       * Second page must be show 23. if there next page must show 22. (It applies to the next pages)
       */
      let condition =
        page === 1 ? (length > defaultLastIndex ? page * -1 : 0) : page * -1;

      let lastIndex = Math.min(defaultLastIndex * page + condition, length - 1);
      let firstIndex =
        page === 1 ? 0 : defaultLastIndex * (page - 1) + (condition + 2);
      lastIndex +=
        lastIndex >= length - 2 &&
        lastIndex - firstIndex >= defaultLastIndex - 2
          ? 1
          : 0;

      result.push({
        lastIndex,
        firstIndex,
        result: lastIndex + 1 - firstIndex,
        page: page,
      });
      if (lastIndex >= length - 1) break;
    }
    return result;
  }

  public static quickFormatContext(
    context: any,
    formats: { [keys: string]: string | number }
  ) {
    const cfx = new ContextFormats();
    Object.entries(formats).map((format) =>
      cfx.formats.set(format[0], String(format[1]))
    );
    return cfx.resolve(context);
  }
}

export type Diff<T, U> = T extends U ? never : T;
