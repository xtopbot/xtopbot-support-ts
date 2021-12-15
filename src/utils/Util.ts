import { PermissionString } from "discord.js";

export default class Util {
  public static permissionsToStringArray(
    permissions: Array<PermissionString>
  ): Array<string> {
    return permissions.map((permission) =>
      permission
        .replace(/guild/gi, "server")
        .replace("_", " ")
        .split(" ")
        .map((_p) => _p.charAt(0).toUpperCase() + _p.toLowerCase().slice(1))
        .join(" ")
    );
  }

  public static escapeRegex(input: string): string {
    return input.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  }
}
