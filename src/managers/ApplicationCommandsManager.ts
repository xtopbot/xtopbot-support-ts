import {
  ApplicationCommandData,
  MessageComponent,
  MessageComponentInteraction,
  ApplicationCommandType,
  ApplicationCommandOptionType,
} from "discord.js";
import app from "../app";
import { BaseCommand } from "../commands/DefaultCommand";
import CommandsManager from "./CommandsManager";

export default class ApplicationCommandsManager extends CommandsManager {
  private getSubCommandGroup(data: ApplicationCommandData): string | null {
    if ("options" in data && Array.isArray(data.options)) {
      const options = data.options;
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        if (option?.type == ApplicationCommandOptionType.SubcommandGroup)
          return option.name;
      }
    }
    return null;
  }

  private getSubCommand(data: ApplicationCommandData): string | null {
    if ("options" in data && Array.isArray(data.options)) {
      const options = data.options;
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        if (option.type == ApplicationCommandOptionType.Subcommand) {
          return option.name;
        } else if (
          option.type == ApplicationCommandOptionType.SubcommandGroup &&
          Array.isArray(option.options)
        ) {
          for (let a = 0; a < option.options.length; a++) {
            if (
              option.options[a].type == ApplicationCommandOptionType.Subcommand
            )
              return option.options[a].name;
          }
        }
      }
    }
    return null;
  }

  public getApplicationCommand(
    name: string,
    type: ApplicationCommandType
  ): BaseCommand | null {
    return (
      this.values.find((command) =>
        command.applicationCommandData.find(
          (acd) =>
            (
              acd.name +
              " " +
              (this.getSubCommandGroup(acd) ?? "" ?? " ") +
              (this.getSubCommand(acd) ?? "")
            )
              .trim()
              .toLowerCase() === name.toLowerCase() && acd.type == type
        )
      ) ?? null
    );
  }

  public getMessageComponentCommand(
    d: MessageComponentInteraction
  ): BaseCommand | null {
    return this.values.find((command) => command.messageComponent(d)) ?? null;
  }

  public deploy(): any {
    const applicationCommandsData: Array<ApplicationCommandData> = this.values
      .map((command) => command.applicationCommandData)
      .flat();
    return app.client.guilds.cache
      .get("884642692980690975")
      ?.commands.set(applicationCommandsData); // This is temporary

    //return app.client.application?.commands.set(applicationCommandsData);
  }
}
