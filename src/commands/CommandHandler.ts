import { Message, Interaction } from "discord.js";
import RegexpTools from "../utils/RegexpTools";
export default class CommandHandler {
  public static onCommand(d: Message): void {
    /*if (d.channel.type == "DM") return;
    if (d instanceof Message) {
      if (!d.channel.permissionsFor(d.member).has(this.userPermissions))
        return;
    } else if (d instanceof Interaction) {
      if (!d.memberPermissions.has(this.userPermissions)) return;
    }*/
  }

  private static match(d: Message) {
    const output = d.content.trim().replace(/\s+/g, " ");
  }
}
