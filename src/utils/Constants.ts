import { PermissionsString } from "discord.js";

export default class Constants {
  public static readonly DEFAULT_LOCALE: string = "en_US";
  public static readonly DEFAULT_COMMAND_DISABLEABLE_VALUE: boolean = true;
  public static readonly DEFAULT_COMMAND_DISABLED_VALUE: boolean = false;
  public static readonly REGEX_SNOWFLAKE = /^\d{17,18}$/;

  public static readonly DEFAULT_PREFIX: string = "!";
  public static readonly CHANNEL_PERMISSIONS: Array<PermissionsString> = [
    "ManageChannels",
    "ViewChannel",
    "CreateInstantInvite",
    "ManageRoles",
    //Text Channel Only
    "ManageWebhooks",
    "AddReactions",
    "SendMessages",
    "SendTTSMessages",
    "ManageMessages",
    "EmbedLinks",
    "AttachFiles",
    "ReadMessageHistory",
    "MentionEveryone",
    "UseExternalEmojis",
    "UseApplicationCommands",
    "ManageThreads",
    "SendMessagesInThreads",
    "CreatePublicThreads",
    "CreatePrivateThreads",
    "UseExternalStickers",
    //Voice Channel Only
    "StartEmbeddedActivities",
    "Stream",
    "Connect",
    "Speak",
    "MuteMembers",
    "DeafenMembers",
    "UseVAD",
    "MoveMembers",
    "RequestToSpeak",
    "PrioritySpeaker",
  ];

  //Support Server
  public static readonly SERVER_ID: string = "";
}
