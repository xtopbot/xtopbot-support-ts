import { Client, Message } from "discord.js";
import MessageCreate from "./MessageCreate";
import InteractionCreate from "./InteractionCreate";
import GuildMemeberAdd from "./GuildMemberAdd";
import Ready from "./Ready";
export default class ListenersHandler {
  public static handler(client: Client) {
    client.on("messageCreate", MessageCreate.onMessageCreate.bind(this));
    client.on(
      "interactionCreate",
      InteractionCreate.onInteractionCreate.bind(this)
    );
    client.on("guildMemberAdd", GuildMemeberAdd.onGuildMemberAdd.bind(this));
    client.on("ready", () => Ready.onReady(client));
  }
}
