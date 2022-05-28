import { GuildMember, PartialGuildMember } from "Discord.js";
import Logger from "../utils/Logger";
import Welcomer from "../plugins/Welcomer";
export default class {
  public static async onAdd(member: GuildMember) {
    await Welcomer.onMemberJoin(member).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: onMemberADd (Welcomer)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }

  public static async onRemove(member: GuildMember | PartialGuildMember) {
    await Welcomer.onMemberLeave(member).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: onMemberRemove (Welcomer)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }
}
