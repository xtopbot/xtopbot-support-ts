import { PermissionsString, ChannelType } from "discord.js";
import { LocaleTag } from "../managers/LocaleManager";
import { UserFlagsPolicy } from "../structures/User";

export default class Constants {
  public static readonly DEFAULT_LOCALE: LocaleTag = "en-US";
  public static readonly DEFAULT_COMMAND_DISABLEABLE_VALUE: boolean = true;
  public static readonly DEFAULT_COMMAND_DISABLED_VALUE: boolean = false;
  public static readonly REGEX_SNOWFLAKE = /^\d{17,18}$/;
  public static readonly WEBHOOKS_CHANNEL_TYPES: ChannelType[] = [
    ChannelType.GuildText,
    ChannelType.GuildNews,
  ];
  public static readonly DEFAULT_INTERACTION_EXPIRES: number =
    1000 /*MiliSecond*/ * 60 /*Minute*/ * 15; //ms
  public static readonly StaffBitwise =
    UserFlagsPolicy.SUPPORT |
    UserFlagsPolicy.MODERATOR |
    UserFlagsPolicy.ADMIN |
    UserFlagsPolicy.DEVELOPER;

  public static readonly DEFAULT_PREFIX: string = "!";

  public static readonly CHANNEL_PERMISSIONS: Array<PermissionsString> = [
    "ManageChannels",
    "ViewChannel",
    "CreateInstantInvite",
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
}
