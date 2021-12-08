import { ClientUser, Message } from "discord.js";
import Constants from "../utils/Constants";
import RegexpTools from "../utils/RegexpTools";
import app from "../app";
import { DefaultCommand } from "./DefaultCommand";
import Commands from "./Commands";
import Logger from "../utils/Logger";
export default class CommandHandler {
  private MATCHES_PREFIXS: RegExp = new RegExp(
    "^(${global.RegexpEscape(prefix)}|<@!?${this.client.user.id}>|${this.client.user.id}|@?${global.RegexpEscape(this.client.user.tag)})( )?",
    "i"
  );

  public static onCommand(d: Message): void {
    Logger.info("[MessageCreate] Received.");
    if (d.channel.type == "DM")
      return Logger.warn(
        `[CommandHandler] was received DM message from ${d.author.tag}<${d.author.id}>;`
      );
    /*if (d instanceof Message) {
      if (!d.channel.permissionsFor(d.member).has(this.userPermissions))
        return;
    } else if (d instanceof Interaction) {
      if (!d.memberPermissions.has(this.userPermissions)) return;
    }*/
  }

  private static matchesCommand(input: string): DefaultCommand | null {
    input = input.trim().replace(/\s+/g, " ");
    const commands = Commands.getCommands();
    const matches = commands.find((command) =>
      this.regexMatches(command).test(input)
    );
    return matches ?? null;
  }

  private static regexMatches(command: DefaultCommand): RegExp {
    return new RegExp(
      `^(${RegexpTools.escape(Constants.DEFAULT_PREFIX)}|<@!?${
        (app.client.user as ClientUser).id
      }>|${(app.client.user as ClientUser).id}|@?${RegexpTools.escape(
        (app.client.user as ClientUser).tag
      )})\s*${RegexpTools.escape(command.name as string)}|${command.aliases
        .map((alias) => RegexpTools.escape(alias))
        .join("|")}`,
      "i"
    );
  }
}
//!|<@!?664684495357607946>|664684495357607946|@?xtop support\s?
