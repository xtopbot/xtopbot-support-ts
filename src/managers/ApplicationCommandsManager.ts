import { ApplicationCommandData } from "discord.js";
import { ApplicationCommandTypes } from "discord.js/typings/enums";
import app from "../app";
import { Command } from "../commands/DefaultCommand";
import CommandsManager from "./CommandsManager";

export default class ApplicationCommandsManager extends CommandsManager {
  private getSubCommandGroup(data: ApplicationCommandData): string | null {
    if ("options" in data && Array.isArray(data.options)) {
      const options = data.options;
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        if (option?.type == "SUB_COMMAND_GROUP") return option.name;
      }
    }
    return null;
  }

  private getSubCommand(data: ApplicationCommandData): string | null {
    if ("options" in data && Array.isArray(data.options)) {
      const options = data.options;
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        if (option?.type == "SUB_COMMAND") {
          return option.name;
        } else if (
          option?.type == "SUB_COMMAND_GROUP" &&
          Array.isArray(option.options)
        ) {
          for (let a = 0; a < option.options.length; a++) {
            if (option.options[a]?.type == "SUB_COMMAND")
              return option.options[a].name;
          }
        }
      }
    }
    return null;
  }

  public getApplicationCommand(
    name: string,
    type: ApplicationCommandTypes
  ): Command | null {
    return (
      this.values.find((command) =>
        command.applicationCommandData.find((acd) => {
          console.log(
            (
              acd.name +
              " " +
              (this.getSubCommandGroup(acd) ?? "" ?? " ") +
              (this.getSubCommand(acd) ?? "")
            ).trim()
          );
          console.log(acd.type == type);
          return (
            (
              acd.name +
              " " +
              (this.getSubCommandGroup(acd) ?? "" ?? " ") +
              (this.getSubCommand(acd) ?? "")
            )
              .trim()
              .toLowerCase() === name.toLowerCase() && acd.type == type
          );
        })
      ) ?? null
    );
  }

  public getMessageComponentCommand(customId: string): Command | null {
    return null;
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
