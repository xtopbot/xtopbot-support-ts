import {
  AutocompleteInteraction,
  ButtonInteraction,
  ClientUser,
  CommandInteraction,
  ContextMenuCommandInteraction,
  GuildMember,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  Message,
  MessageOptions,
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
    checkRequirements: boolean = true
  ): Promise<Response> {
    if (!dcm.d.inGuild())
      return new Response(ResponseCodes.COMMAND_ONLY_USABLE_ON_GUILD, {
        content: "This command is not allowed to be used in DM.", // related to locale system
      });
    await dcm.fetch();
    if (checkRequirements) {
      //Check command Requirements to continue to execute command
      const commandRequirements = new CommandRequirementsHandler(dcm);
      const commandRequirementsCheck: Response | boolean =
        await commandRequirements.checkAll();

      if (commandRequirementsCheck instanceof Response)
        return commandRequirementsCheck;

      if (!commandRequirementsCheck)
        throw new Exception(
          "Something went wrong while processing the command requirements",
          Severity.FAULT
        );
    }
    return dcm.command.execute(dcm);
  }

  public static async executeHandler(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuCommandInteraction
      | AutocompleteInteraction,
    command: Command
  ): Promise<void> {
    const dcm: CommandMethod = new CommandMethod(d, command);
    try {
      return this.response(
        dcm,
        await this.executeCommand(
          dcm,
          !(dcm instanceof AutocompleteInteraction)
        )
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
        dcm.d.channel.send(response.message as MessageOptions);
        return;
      } else if (
        dcm.d instanceof CommandInteraction ||
        dcm.d instanceof ContextMenuCommandInteraction
      ) {
        if (!response)
          throw new Exception(
            "Unable to detect response for this interaction",
            Severity.FAULT
          );
        if (!dcm.d.deferred)
          return dcm.d.reply(response.message as InteractionReplyOptions);
        dcm.d.editReply(response.message as InteractionReplyOptions);
        return;
      } else if (
        dcm.d instanceof ButtonInteraction ||
        dcm.d instanceof SelectMenuInteraction
      ) {
        if (!response) return dcm.d.deferUpdate();

        if (response.options?.update)
          return dcm.d.update(response.message as InteractionUpdateOptions);

        if (!dcm.d.deferred)
          return dcm.d.reply(response.message as InteractionReplyOptions);
        dcm.d.editReply(response.message as InteractionReplyOptions);
        return;
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
      app.commands.values.find(
        (command) =>
          !command.applicationCommandOnly &&
          this.regexMatches(command).test(input)
      ) ?? null
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
