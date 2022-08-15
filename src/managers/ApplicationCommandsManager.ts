import {
  ApplicationCommandData,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ModalSubmitInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
} from "discord.js";
import app from "../app";
import { BaseCommand } from "../commands/BaseCommand";
import ComponentMethod, {
  AnyComponentInteraction,
} from "../commands/ComponentMethod";
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

  public getCommadFromComponent(
    d:
      | ButtonInteraction
      | SelectMenuInteraction
      | ModalSubmitInteraction
      | ComponentMethod<AnyComponentInteraction>
  ): BaseCommand | null {
    return (
      this.values.find((command) =>
        command.messageComponent(
          d instanceof ComponentMethod ? d : new ComponentMethod(d, command)
        )
      ) ?? null
    );
  }

  public deploy(options?: { guildId: string; commands: any[] }): any {
    const _acd = this.values
      .map((command) => command.applicationCommandData)
      .flat();
    const acd = _acd
      .filter(
        (value, index, self) =>
          index === self.findIndex((t) => t.name === value.name)
      )
      .map((_b) => {
        _b = { ..._b };
        (_b as any).options = _acd
          .filter((_a) => _a.name === _b.name)
          .map((_a) => (_a as any).options ?? [])
          .flat()
          .filter(
            (value, index, self) =>
              index === self.findIndex((t) => t.name === value.name)
          )
          .map((__b, _index, self) => {
            __b.options = self
              .filter((_a) => _a.name === __b.name)
              .map((_a) => _a.options ?? [])
              .flat();
            return __b;
          });
        return _b;
      });

    if (options?.guildId)
      return app.client.application?.commands.set(
        options?.commands ?? acd,
        options?.guildId
      );
    return app.client.application?.commands.set(options?.commands ?? acd);
  }
}
