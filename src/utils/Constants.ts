import { PermissionString } from "discord.js";

export default class Constants {
  public static readonly DEFAULT_COMMAND_DISABLEABLE_VALUE: boolean = true;
  public static readonly DEFAULT_COMMAND_DISABLED_VALUE: boolean = false;
  public static readonly REGEX_SNOWFLAKE = /^\d{17,18}$/;

  public static readonly DEFAULT_PREFIX: string = "!";
  public static readonly CHANNEL_PERMISSIONS: Array<PermissionString> = [
    "MANAGE_CHANNELS",
    "VIEW_CHANNEL",
    //Text Channel Only
    "ADD_REACTIONS",
    "SEND_MESSAGES",
    "SEND_TTS_MESSAGES",
    "MANAGE_MESSAGES",
    "EMBED_LINKS",
    "ATTACH_FILES",
    "READ_MESSAGE_HISTORY",
    "MENTION_EVERYONE",
    "USE_EXTERNAL_EMOJIS",
    "USE_APPLICATION_COMMANDS",
    "MANAGE_THREADS",
    "USE_PUBLIC_THREADS",
    "CREATE_PUBLIC_THREADS",
    "USE_PRIVATE_THREADS",
    "CREATE_PRIVATE_THREADS",
    "USE_EXTERNAL_STICKERS",
    "SEND_MESSAGES_IN_THREADS",
    "START_EMBEDDED_ACTIVITIES",
    //Voice Channel Only
    "STREAM",
    "CONNECT",
    "SPEAK",
    "MUTE_MEMBERS",
    "MOVE_MEMBERS",
    "REQUEST_TO_SPEAK",
  ];

  //Support Server
  public static readonly SERVER_ID: string = "";
}
