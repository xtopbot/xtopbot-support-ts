import { GuildMember } from "Discord.js";
import Constants from "../utils/Constants";
import Logger from "../utils/Logger";
export default class GuildMemberAdd {
  public static onGuildMemberAdd(member: GuildMember) {
    try {
      this.memberJoined.bind(member);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );

      console.error(err);
    }
  }
  private static memberJoined(member: GuildMember): void {
    if (member.guild.id !== Constants.SERVER_ID) return;
    const csu = member.guild;
  }
}
