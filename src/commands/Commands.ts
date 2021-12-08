import { ApplicationCommandTypes } from "discord.js/typings/enums";
import Eval from "./admin/Eval";
import { DefaultCommand } from "./DefaultCommand";

export default class Commands {
  private static commands: Array<DefaultCommand> = [new Eval()];

  public static getCommands(): Array<DefaultCommand> {
    return this.commands.filter((command) => !command.applicationCommandOnly);
  }

  public static getCommand(
    input: string,
    useAliases: boolean = false
  ): DefaultCommand | null {
    return (
      this.commands.find(
        (command) =>
          !command.applicationCommandOnly &&
          (command.name === input ||
            (useAliases ? command.aliases.includes(input) : false))
      ) ?? null
    );
  }
  private static getApplicationCommand(
    input: string,
    type: ApplicationCommandTypes
  ): DefaultCommand | null {
    return (
      this.commands.find((command) =>
        command.applicationCommandData.find((apd) => {
          apd.type === type && apd.name === input;
        })
      ) ?? null
    );
  }
  public static getSlashCommand(input: string): DefaultCommand | null {
    return this.getApplicationCommand(
      input,
      ApplicationCommandTypes.CHAT_INPUT
    );
  }

  public static getContextMenuUserName(input: string): DefaultCommand | null {
    return this.getApplicationCommand(input, ApplicationCommandTypes.USER);
  }

  public static getContextMenuMessage(input: string): DefaultCommand | null {
    return this.getApplicationCommand(input, ApplicationCommandTypes.MESSAGE);
  }
}
