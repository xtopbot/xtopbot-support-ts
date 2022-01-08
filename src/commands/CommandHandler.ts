import {
  ButtonInteraction,
  ClientUser,
  CommandInteraction,
  ContextMenuInteraction,
  GuildMember,
  Message,
  SelectMenuInteraction,
} from "discord.js";
import Constants from "../utils/Constants";
import Util from "../utils/Util";
import app from "../app";
import { DefaultCommand, Command } from "./DefaultCommand";
import Logger from "../utils/Logger";
import User from "../structures/User";
import CommandRequirementsHandler from "./RequirementHandler";
import FinalResponse, { ResponseCodes } from "../utils/FinalResponse";
import Exception, { Severity } from "../utils/Exception";
import CommandMethod from "./CommandMethod";
export default class CommandHandler {
  public static async onCommand(d: Message): Promise<void> {
    Logger.info("[MessageCreate] Received.");
    const command: Command | null = this.matchesCommand(d.content);
    if (!(command instanceof DefaultCommand))
      return Logger.warn(
        `[CommandHandler] Unable to find matches command from ${d.author.tag}<${d.author.id}>;`
      );
    Logger.info(`[CommandHandler] Found Command Macthes ${command.name}`);

    this.executeHandler(d, command);
  }

  private static async executeCommand(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction,
    command: Command
  ): Promise<FinalResponse> {
    if (!d.inGuild())
      return new FinalResponse(ResponseCodes.COMMAND_ONLY_USABLE_ON_GUILD, {
        content: "This command is not allowed to be used in DM.",
      });
    // fetch user form our data;
    const user: User = await app.users.fetch(
      d instanceof Message ? d.author : d.user
    );

    const channel =
      d.channel !== null ? d.channel : d.guild?.channels.cache.get(d.channelId);
    if (!channel)
      throw new Exception(
        "Unable to find channel in cache.",
        Severity.SUSPICIOUS
      );
    const member =
      d.member instanceof GuildMember
        ? d.member
        : await d.guild?.members.fetch(user.id);
    if (!member)
      throw new Exception(
        "Unable to find member in cache.",
        Severity.SUSPICIOUS
      );

    //Check command Requirements to continue to execute command
    const commandRequirements = new CommandRequirementsHandler(
      command,
      channel,
      member,
      user
    );
    const commandRequirementsCheck: FinalResponse | boolean =
      commandRequirements.checkAll();
    console.log(commandRequirements);

    if (commandRequirementsCheck instanceof FinalResponse)
      return commandRequirementsCheck;

    if (!commandRequirementsCheck)
      throw new Exception(
        "Something went wrong while processing the command requirements",
        Severity.FAULT
      );
    return command.execute(new CommandMethod(d, command));
  }

  public static async executeHandler(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction,
    command: Command
  ): Promise<void> {
    try {
      return this.response(d, command, await this.executeCommand(d, command));
    } catch (err) {
      console.log(err);
      if (err instanceof Exception) {
        // just reply to requster
      } else {
        // reply to requester and debugging error
      }
    }
  }

  private static async response(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction,
    command: Command,
    r: FinalResponse | null
  ): Promise<void> {
    if (d instanceof Message) {
      if (!r) return;
      d.channel.send(r.response);
      return;
    } else if (d instanceof CommandInteraction) {
      if (!r) {
        if (!(d instanceof (ButtonInteraction || SelectMenuInteraction)))
          throw new Exception("e", Severity.FAULT);
        return d.deferUpdate();
      }
      //return d.reply(r.response);
      return d.reply({
        content: "This just a test. (interaction)",
        ephemeral: true,
      });
      // do stuff
    }
  }

  private static matchesCommand(input: string): Command | null {
    input = input.trim().replace(/\s+/g, " ");
    return (
      app.commands.values.find((command) => {
        let res = this.regexMatches(command).test(input);
        return res;
      }) ?? null
    );
  }

  private static get clientUser(): ClientUser {
    if (!app.client.user)
      throw new Exception(
        `[${this.constructor.name}] (Client User) field is not object cannot handler this.`,
        Severity.FAULT
      );
    return app.client.user;
  }

  public static regexMatches(command: Command): RegExp {
    const aliases: Array<string> = command.aliases
      .map((alias) => Util.escapeRegex(alias))
      .filter((alias) => alias !== "");
    const regex = new RegExp(
      `^(${Util.escapeRegex(Constants.DEFAULT_PREFIX)}|<@!?${
        this.clientUser.id
      }>|${this.clientUser.id}|@?${Util.escapeRegex(
        this.clientUser.tag
      )})\\s*(${Util.escapeRegex(command.name as string)}${
        !!aliases.length ? "|" + aliases.join("|") : ""
      })`,
      "i"
    );
    return regex;
  }
}
//!|<@!?664684495357607946>|664684495357607946|@?xtop support\s?
