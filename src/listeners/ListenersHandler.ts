import { Client } from "discord.js";
import Message from "./Message";
import InteractionCreate from "./InteractionCreate";
import GuildMember from "./GuildMember";
import Ready from "./Ready";
import Thread from "./Thread";

export default class ListenersHandler {
  public static handler(client: Client) {
    client.on("messageCreate", Message.onMessageCreate.bind(this));
    client.on("messageDelete", Message.onMessageDelete.bind(this));
    client.on("messageUpdate", Message.onMessageUpdate.bind(this));
    client.on(
      "interactionCreate",
      InteractionCreate.onInteractionCreate.bind(this)
    );
    client.on("guildMemberAdd", GuildMember.onAdd.bind(this));
    client.on("guildMemberRemove", GuildMember.onRemove.bind(this));
    client.on("guildMemberUpdate", GuildMember.onUpdate.bind(this));
    client.on("threadMembersUpdate", Thread.onThreadMembersUpdate.bind(this));
    client.on("threadUpdate", Thread.onThreadUpdate.bind(this));
    client.on("threadDelete", Thread.onThreadDeleted.bind(this));
    client.on("ready", () => Ready.onReady(client));
  }
}
