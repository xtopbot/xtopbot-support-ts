import { GuildMember, PartialGuildMember } from "Discord.js";
import Logger from "../utils/Logger";
import Welcomer from "../plugins/Welcomer";
export default class {
  public static async onAdd(member: GuildMember) {
    try {
      await Welcomer.onMemberJoin(member);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );
      console.error(err);
    }
  }

  public static async onRemove(member: GuildMember | PartialGuildMember) {
    try {
      Welcomer.onMemberLeave(member as GuildMember);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );
      console.error(err);
    }
  }
}
