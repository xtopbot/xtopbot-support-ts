import { PermissionsString } from "discord.js";
import Exception, { Severity } from "./Exception";
import { MessageResponse } from "./Response";

export default class Util {
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
    try {
      const json = JSON.parse(value);
      return json;
    } catch (err) {
      return null;
    }
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
}

export type Diff<T, U> = T extends U ? never : T;
