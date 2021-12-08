import { NewsChannel, TextChannel, ThreadChannel, User } from "discord.js";
import { DefaultCommand } from "./DefaultCommand";

export default class CommandRequirementsHandler {
  private readonly command: DefaultCommand;
  public constructor(command: DefaultCommand) {
    this.command = command;
  }
  public all(
    user: User,
    channel: TextChannel | NewsChannel | ThreadChannel
  ): boolean {
    return (
      this.botPermissionsChannel(channel) ??
      this.userLevelPolicy(user) ??
      this.memberPermissionsChannel(channel) ??
      false
    );
  }

  public userLevelPolicy(user: User): boolean {
    return false;
  }

  public botPermissionsChannel(
    channel: TextChannel | NewsChannel | ThreadChannel
  ): boolean {
    return false;
  }

  public memberPermissionsChannel(
    channel: TextChannel | NewsChannel | ThreadChannel
  ): boolean {
    return false;
  }
}
