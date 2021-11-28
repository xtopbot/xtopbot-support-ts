import {
  ButtonInteraction,
  SelectMenuInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  AutocompleteInteraction,
  Interaction,
} from "discord.js";

export default class InteractionHandler {
  public static onInteraction(d: Interaction) {
    if (d.isCommand()) return this.onSlashCommand(d);
    if (d.isButton()) return this.onButton(d);
    if (d.isSelectMenu()) return this.onSelectMenu(d);
    if (d.isContextMenu()) return this.onContextMenu(d);
    if (d.isAutocomplete()) return this.onAutoComplete(d);
  }

  private static onSlashCommand(d: CommandInteraction): void {}

  private static onButton(d: ButtonInteraction): void {}

  private static onSelectMenu(d: SelectMenuInteraction): void {}

  private static onContextMenu(d: ContextMenuInteraction): void {}

  private static onAutoComplete(d: AutocompleteInteraction): void {}
}
