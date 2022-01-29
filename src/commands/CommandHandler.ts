import {
  AutocompleteInteraction,
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
import Response, { ResponseCodes } from "../utils/Response";
import Exception, { Severity } from "../utils/Exception";
import CommandMethod from "./CommandMethod";
export default class CommandHandler {
  public static async process(d: Message): Promise<void> {
    Logger.info("[MessageCreate] Received.");
    const command: Command | null = this.matchesCommand(d.content);
    if (!(command instanceof DefaultCommand))
      return Logger.warn(
        `[CommandHandler] Unable to find matches command from ${d.author.tag}<${d.author.id}>;`
      );
    Logger.info(`[CommandHandler] Found Command Macthes ${command.name}`);

    this.executeHandler(d, command);
  }

  protected static async executeCommand(
    dcm: CommandMethod,
    command: Command
  ): Promise<Response> {
    if (!dcm.d.inGuild())
      return new Response(ResponseCodes.COMMAND_ONLY_USABLE_ON_GUILD, {
        content: "This command is not allowed to be used in DM.",
      });

    const channel =
      dcm.d.channel !== null
        ? dcm.d.channel
        : dcm.d.guild?.channels.cache.get(dcm.d.channelId);
    if (!channel)
      throw new Exception(
        "Unable to find channel in cache.",
        Severity.SUSPICIOUS
      );
    const member =
      dcm.d.member instanceof GuildMember
        ? dcm.d.member
        : await dcm.d.guild?.members.fetch(dcm.author.id);
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
      dcm.user
    );
    const commandRequirementsCheck: Response | boolean =
      commandRequirements.checkAll();

    if (commandRequirementsCheck instanceof Response)
      return commandRequirementsCheck;

    if (!commandRequirementsCheck)
      throw new Exception(
        "Something went wrong while processing the command requirements",
        Severity.FAULT
      );
    return command.execute(dcm);
  }

  public static async executeHandler(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction
      | AutocompleteInteraction,
    command: Command
  ): Promise<void> {
    // fetch user form our data;
    const user: User = await app.users.fetch(
      d instanceof Message ? d.author : d.user
    );
    const dcm: CommandMethod = new CommandMethod(d, command, user);
    try {
      return this.response(
        dcm,
        dcm instanceof AutocompleteInteraction
          ? await command.execute(dcm)
          : await this.executeCommand(dcm, command)
      );
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
    dcm: CommandMethod,
    response: Response | null
  ): Promise<void> {
    //Auto Complete Response
    if (dcm.d instanceof AutocompleteInteraction) {
      if (!response?.options?.response)
        return Logger.info(
          `[Response<Autocomplete>] We decected no response form [${dcm.command.name}] requested by ${dcm.author.tag}<${dcm.author.id}>`
        );
      dcm.d.respond(response.options.response);
    } else {
      if (response?.message === null)
        return Logger.info(
          `[Response] We decected no response form [${dcm.command.name}] requested by ${dcm.author.tag}<${dcm.author.id}>`
        );
      if (dcm.d instanceof Message) {
        if (!response) return;
        dcm.d.channel.send(response.message);
        return;
      } else if (
        dcm.d instanceof CommandInteraction ||
        dcm.d instanceof ContextMenuInteraction
      ) {
        if (!response)
          throw new Exception(
            "Unable to detect response for this interaction",
            Severity.FAULT
          );

        return dcm.d.reply(response.message);
      } else if (
        dcm.d instanceof ButtonInteraction ||
        dcm.d instanceof SelectMenuInteraction
      ) {
        if (!response) return dcm.d.deferUpdate();

        if (response.options?.update) return dcm.d.update(response.message);

        return dcm.d.reply(response.message);
      } else
        throw new Exception(
          "Unable to detect interaction type",
          Severity.FAULT
        );
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
