import { GuildMember, PartialGuildMember } from "discord.js";
import Logger from "../utils/Logger";
import Welcomer from "../plugins/Welcomer";
import AuditLog from "../plugins/AuditLog";

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
    await AuditLog.memberLeft(member).catch((err) =>
      Logger.trace(
        err,
        `[App](Event: onMemberRemove (AuditLog)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
    await Welcomer.onMemberLeave(member).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: onMemberRemove (Welcomer)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }

  public static async onUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ) {
    await AuditLog.timeoutMember(oldMember, newMember).catch((err) =>
      Logger.trace(
        err,
        `[App](Event: onMemberRemove (AuditLog)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }
}
