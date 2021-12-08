import { GuildMember } from "Discord.js";
import Constants from "../utils/Constants";
import Logger from "../utils/Logger";
export default class GuildMemberAdd {
  public static onGuildMemberAdd(member: GuildMember) {
    try {
      this.memberJoined.bind(member);
    } catch (err) {
      if (err instanceof Error) {
        Logger.error(
          `[App](Event: guildMemberAdd) Error while execute: ${err.message}`
        );
        console.error(err);
      }
    }
  }
  private static memberJoined(member: GuildMember): void {
    if (member.guild.id !== Constants.SERVER_ID) return;
    const csu = member.guild;
  }
}
