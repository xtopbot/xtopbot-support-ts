import {
  AutocompleteInteraction,
  ButtonInteraction,
  ClientUser,
  ChatInputCommandInteraction,
  Message,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import Constants from "../utils/Constants";
import Util from "../utils/Util";
import app from "../app";
import { BaseCommand } from "./BaseCommand";
import Logger from "../utils/Logger";
import CommandRequirementsHandler from "./RequirementHandler";
import Response, {
  Action,
  AnyResponse,
  ResponseCodes,
} from "../utils/Response";
import Exception, { Severity } from "../utils/Exception";
import CommandMethod, {
  AnyMethod,
  CommandMethodTypes,
  Method,
} from "./CommandMethod";
import ComponentMethod, { AnyComponentInteraction } from "./ComponentMethod";
import InteractionOnly from "../plugins/InteractionOnly";

export default class CommandHandler {
  public static async process(d: Message): Promise<void> {
    Logger.info("[MessageCreate] Received.");
    const command = this.matchesCommand(d.content);
    if (!(command instanceof BaseCommand))
      return Logger.warn(
        `[CommandHandler] Unable to find matches command from ${d.author.tag}<${d.author.id}>;`
      );
    if (await InteractionOnly.isExecutable(d, d.author)) return;

    Logger.info(`[CommandHandler] Found Command Macthes ${command.name}`);

    this.executeHandler(new CommandMethod(d, command));
  }

  protected static async executeCommand(
    dcm: AnyMethod,
    checkRequirements: boolean = true
  ): Promise<Response<AnyResponse>> {
    if (!dcm.d.inGuild())
      return new Response(
        ResponseCodes.COMMAND_ONLY_USABLE_ON_GUILD,
        {
          content: "This command is not allowed to be used in DM.", // related to locale system
        },
        Action.REPLY
      );
    await dcm.fetch();
    if (checkRequirements) {
      //Check command Requirements to continue to execute command
      const commandRequirements = new CommandRequirementsHandler(dcm);
      try {
        await commandRequirements.checkAll();
      } catch (err) {
        if (err instanceof Response) return err;
        throw new Exception(
          "Something went wrong while processing the command requirements",
          Severity.FAULT,
          err
        );
      }
    }
    return dcm.command.execute(dcm);
  }

  public static async executeHandler(
    dcm: AnyMethod,
    followUp: boolean = false
  ): Promise<void> {
    try {
      const response = await this.executeCommand(
        dcm,
        !(dcm instanceof AutocompleteInteraction)
      );
      await this.response(dcm, response, followUp);
      if (
        dcm.isComponentInteraction() &&
        !followUp &&
        response.code === ResponseCodes.SUCCESS
      )
        this.commandFollowUp(dcm);
    } catch (err) {
      Logger.error("Error in command handler");
      console.log(err);
      if (err instanceof Exception) {
        // just reply to requster
        this.response(
          dcm,
          new Response(ResponseCodes.EXCEPTION, err.message),
          false
        );
      } else {
        // reply to requester and debugging error
        if (dcm.d instanceof Message) return;
        this.response(
          dcm,
          new Response(
            ResponseCodes.UNKNOWN,
            new Exception(
              "An unknown error occurred",
              Severity.FAULT,
              err
            ).message
          ),
          false
        );
      }
    }
  }

  private static async response(
    dcm: AnyMethod,
    response: Response<AnyResponse>,
    followUp: boolean
  ): Promise<void> {
    const user = dcm.d instanceof Message ? dcm.d.author : dcm.d.user;
    dcm.cf.setObject("user", user);
    dcm.cf.formats.set("user.tag", user.tag);
    const message = dcm.cf.resolve(response);
    if (dcm.d instanceof Message) {
      if (response.message && response.action === Action.REPLY) {
        dcm.d.channel.send(message);
        return;
      }
    } else if (dcm.d instanceof AutocompleteInteraction)
      return dcm.d.respond(message);
    else if (followUp) {
      dcm.d.followUp(message);
      return;
    } else if (dcm.d instanceof ChatInputCommandInteraction) {
      if (response.action === Action.REPLY) {
        if (dcm.d.deferred) dcm.d.editReply(message);
        else dcm.d.reply(message);
        return;
      }
      if (response.action === Action.MODAL) {
        dcm.d.showModal(message);
        return;
      }
    } else if (
      dcm.d instanceof SelectMenuInteraction ||
      dcm.d instanceof ButtonInteraction
    ) {
      if (response.action === Action.REPLY) {
        if (dcm.d.deferred) dcm.d.editReply(message);
        else dcm.d.reply(message);
        return;
      }
      if (response.action === Action.UPDATE) {
        dcm.d.update(message);
        return;
      }
      if (response.action === Action.DEFER) {
        dcm.d.deferUpdate(message);
        return;
      }
      if (response.action === Action.MODAL) {
        dcm.d.showModal(message);
        return;
      }
    } else if (
      dcm.d instanceof UserContextMenuCommandInteraction ||
      dcm.d instanceof MessageContextMenuCommandInteraction
    ) {
      if (response.action === Action.REPLY) {
        if (dcm.d.deferred) dcm.d.editReply(message);
        else dcm.d.reply(message);
        return;
      }
      if (response.action === Action.MODAL) {
        dcm.d.showModal(message);
        return;
      }
    } else if (dcm.d instanceof ModalSubmitInteraction) {
      if (response.action === Action.REPLY) {
        if (dcm.d.deferred) dcm.d.editReply(message);
        else dcm.d.reply(message);
        return;
      }
      if (dcm.d.isFromMessage()) {
        if (response.action === Action.UPDATE) {
          dcm.d.update(message);
          return;
        }
        if (response.action === Action.DEFER) {
          dcm.d.deferUpdate(message);
          return;
        }
      }
    }
    Logger.info(
      `[Response<${dcm.d.type}>] We decected no response form [${dcm.command.name}] requested by ${dcm.author.tag}<${dcm.author.id}>`
    );
    if (
      !(dcm.d instanceof AutocompleteInteraction) &&
      !(dcm.d instanceof Message)
    )
      throw new Exception(
        "Unable To Detect Interaction Action Type",
        Severity.FAULT,
        {
          action:
            typeof response.action == "number" ? Action[response.action] : null,
          message: response.message,
          code: response.code,
        }
      );
  }

  private static commandFollowUp(dcm: Method<AnyComponentInteraction>) {
    if (dcm.isFollowUp()) {
      const followUp = dcm.customIds.findIndex(
        (customId) => customId == "followUp"
      );
      dcm.customIds.slice(followUp + 1);
      const command = app.commands.getCommadFromComponent(dcm);
      if (!command)
        return Logger.debug(
          "CustomId have follow up argument but command not found. followUp:" +
            dcm.getValue("followUp", false)
        );
      return this.executeHandler(new ComponentMethod(dcm.d, command), true);
    }
  }

  private static matchesCommand(input: string): BaseCommand | null {
    if (!input) return null;
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

  public static regexMatches(command: BaseCommand): RegExp {
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
