import { Client, Message } from "discord.js";
import MessageCreate from "./MessageCreate";
import InteractionCreate from "./InteractionCreate";
import GuildMember from "./GuildMember";
import Ready from "./Ready";
export default class ListenersHandler {
  public static handler(client: Client) {
    client.on("messageCreate", MessageCreate.onMessageCreate.bind(this));
    client.on(
      "interactionCreate",
      InteractionCreate.onInteractionCreate.bind(this)
    );
    client.on("guildMemberAdd", GuildMember.onAdd.bind(this));
    client.on("guildMemberRemove", GuildMember.onRemove.bind(this));
    client.on("ready", () => Ready.onReady(client));
  }
}
